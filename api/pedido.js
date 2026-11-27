"use strict";
// POST /api/pedido  ·  ÚNICO caminho de gravação do pedido do cliente (sem login).
//  - o preço é RECALCULADO aqui com os preços reais da loja no Firestore; o total enviado pelo cliente só é conferido:
//    se vier MENOR que o calculado, o pedido é rejeitado (422 preco_divergente). O que fica gravado é o valor do servidor.
//  - loja fechada não recebe pedido novo (409 loja_fechada); estoque insuficiente (409) e entrega desligada (422) também barram,
//    SEMPRE: nenhum campo enviado pelo navegador (st, pag...) afrouxa uma validação.
//  - o status de pagamento (st) é decidido AQUI: Pix nasce "pend" (a loja confere e libera pend → ok); pagamento no local nasce "ok".
//    O "st" que o cliente mandar é ignorado.
//  - grava com credencial de servidor (conta de serviço); as regras do Firestore negam gravação direta de cliente.
const fsx = require("./_fs");
const limite = require("./limite");
const baixa = require("./baixa");

const txt = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");
class Rej extends Error { constructor(code, erro, extra) { super(erro); this.code = code; this.erro = erro; this.extra = extra || {}; } }

// mesma conta do app (index.html: ePrice / cartSvc): preço base + adicionais (modo cardápio) × quantidade
function addons(x) {
  return (Array.isArray(x.opts) ? x.opts : []).map((o) => {
    const a = String(o).split(":");
    return { n: a[0].trim(), p: parseFloat(String(a[1] || "0").replace(",", ".")) || 0 };
  });
}
function calcula(S, lin) {
  const svcs = Array.isArray(S.services) ? S.services : [];
  let total = 0;
  const linhas = [];
  const itens = [];
  for (const l of lin) {
    const x = svcs.filter((s) => s && s.id == l.id)[0];
    if (!x || !isFinite(+x.price)) throw new Rej(422, "produto_invalido", { id: l.id });
    // adicionais só existem no modo cardápio e só os do catálogo do produto; fora dele, texto livre em "opt" é descartado (B-02)
    const nomes = S.modo === "cardapio" && l.opt ? String(l.opt).split(";").map((t) => t.trim()).filter(Boolean) : [];
    let p = +x.price || 0;
    if (S.modo === "cardapio") {
      const ad = addons(x);
      for (const nm of nomes) {
        if (!ad.some((a) => a.n === nm)) throw new Rej(422, "adicional_invalido", { id: l.id, adicional: nm });
        ad.forEach((a) => { if (a.n === nm) p += a.p; });
      }
    }
    total += p * l.q;
    linhas.push({ id: +l.id, q: l.q, opt: nomes.join(";") });
    itens.push(l.q + "x " + txt(x.name, 120) + (nomes.length ? " (" + nomes.join(", ") + ")" : ""));
  }
  return { total: Math.round(total * 100) / 100, lin: linhas, items: itens.join("; ") };
}

// Estoque. O disponível = estoque publicado - RESERVADO. O reservado é um contador por produto
// (pf_lojas/{uid}/reservado/{produtoId}, campo q) mantido só pelo servidor, em transação: sobe aqui, quando o pedido nasce,
// e desce em /api/baixa, quando o lojista dá baixa ou exclui o pedido. Sem controle de estoque = ilimitado.
// O contador de um produto que ainda não tem documento é semeado UMA vez a partir dos pedidos sem baixa dos últimos 7 dias.
const JANELA_MS = 7 * 24 * 3600e3; // só para semear um contador novo: pedidos sem baixa dos últimos 7 dias
function controlados(S, lin) {
  const svcs = Array.isArray(S.services) ? S.services : [];
  const ids = new Set(lin.map((l) => String(l.id)));
  return svcs.filter((s) => s && ids.has(String(s.id)) && s.estoque_atual != null && isFinite(+s.estoque_atual));
}
// pedidos sem baixa, do mais antigo para o mais novo (hora de criação no servidor; empate = id)
function semBaixa(lista) {
  return (lista || []).filter((p) => p.d && p.d.baixa !== true && Array.isArray(p.d.lin) && p.d.lin.length)
    .sort((a, b) => (a.createTime < b.createTime ? -1 : a.createTime > b.createTime ? 1 : a.id - b.id));
}
function somaPorProduto(pedidos, ate) { // soma as quantidades; "ate" = id do pedido onde parar (inclusive)
  const m = {};
  for (const p of pedidos) {
    for (const l of p.d.lin) m[l.id] = (m[l.id] || 0) + (+l.q || 0);
    if (ate != null && p.id === ate) break;
  }
  return m;
}
function confereEstoque(S, lin, reservado) {
  const res = reservado || {};
  const soma = {};
  for (const l of lin) soma[l.id] = (soma[l.id] || 0) + l.q;
  for (const x of controlados(S, lin)) {
    const livre = Math.max(0, +x.estoque_atual - (res[x.id] || 0));
    if (soma[x.id] > livre) throw new Rej(409, "estoque_insuficiente", { id: +x.id, disponivel: livre });
  }
}

// Cria o pedido e reserva o estoque NA MESMA transação (REST: begin → leituras → commit).
// Devolve { id } | { rej:{code,body} } | { falha:true } | { aberta:true } (a transação não funcionou: grava sem reservar, rv:false).
async function reservaEGrava(uid, o, base, tk) {
  const quer = {};
  for (const l of o.lin) quer[l.id] = (quer[l.id] || 0) + l.q;
  let id = o.id;
  for (let t = 0; t < 8; t++) {
    const tx = await fsx.begin(tk);
    if (!tx) return { aberta: true };
    const soltar = async (r) => { await fsx.rollback(tx, tk); return r; };
    // estoque publicado lido DENTRO da transação (junto do contador), para os dois andarem consistentes
    const pb = await fsx.getDocTx("pf_lojas_publicas/" + encodeURIComponent(uid), tx, tk);
    let S2 = null;
    if (pb.ok && pb.f) { try { S2 = JSON.parse(fsx.str(pb.f.data) || ""); } catch (e) { S2 = null; } }
    if (!S2) return soltar({ aberta: true });
    const ctl = controlados(S2, o.lin);
    if (!ctl.length) return soltar({ aberta: true });
    const cont = {};
    for (const x of ctl) {
      const c = await fsx.getDocTx("pf_lojas/" + encodeURIComponent(uid) + "/reservado/" + encodeURIComponent(x.id), tx, tk);
      if (!c.ok) return soltar({ aberta: true });
      cont[x.id] = { existe: !!c.f, q: c.f ? Math.max(0, +fsx.fromFs(c.f.q) || 0) : 0 };
    }
    const faltam = ctl.filter((x) => !cont[x.id].existe);
    if (faltam.length) {
      const lista = await fsx.pedidosDesde(uid, Date.now() - JANELA_MS, 300, tk);
      if (!lista) return soltar({ aberta: true });
      const seed = somaPorProduto(semBaixa(lista).filter((p) => p.d.rv !== false));
      faltam.forEach((x) => { cont[x.id].q = seed[x.id] || 0; });
    }
    { // o estoque é conferido para TODO pedido (o status vem do servidor, nunca do cliente)
      const res = {}; ctl.forEach((x) => { res[x.id] = cont[x.id].q; });
      try { confereEstoque(S2, o.lin, res); } catch (e) {
        if (e instanceof Rej) return soltar({ rej: { code: e.code, body: Object.assign({ erro: e.erro }, e.extra) } });
        await fsx.rollback(tx, tk); throw e;
      }
    }
    const w = [fsx.wCria("pf_lojas/" + uid + "/pedidos/" + id, Object.assign({ id }, base, { rv: true }))];
    ctl.forEach((x) => {
      const cp = "pf_lojas/" + uid + "/reservado/" + x.id;
      w.push(cont[x.id].existe ? fsx.wSoma(cp, "q", quer[x.id]) : fsx.wCria(cp, { q: cont[x.id].q + quer[x.id] }));
    });
    const r = await fsx.commit(w, tx, tk);
    if (r === "ok") return { id };
    if (r === "conflito") continue; // outra transação passou na frente: lê de novo e decide
    if (r === "existe") { // id do pedido já ocupado, ou o contador foi criado por outro pedido agora
      const ex = await fsx.getDoc("pf_lojas/" + uid + "/pedidos/" + id, tk);
      if (ex) { if (fsx.str(ex.tt) === o.tt) return { id }; id++; if (id - o.id >= 5) return { falha: true }; } // reenvio do mesmo pedido não conta duas vezes
      continue;
    }
    return { falha: true };
  }
  return { falha: true };
}

// valida o formato do que veio do cliente (nada daqui é confiado para dinheiro)
function limpa(p) {
  if (!p || typeof p !== "object") return null;
  if (!Number.isInteger(p.id) || p.id < 1e12) return null;
  // M-03: id do futuro (relógio do aparelho adiantado ou forjado) vira o horário do servidor; id é ordem, não pode ser forjado
  const idOk = p.id <= Date.now() + 10 * 60e3 ? p.id : Date.now();
  if (typeof p.tt !== "string" || !/^[a-f0-9]{32}$/.test(p.tt)) return null;
  if (typeof p.name !== "string" || p.name.trim().length < 2 || p.name.length > 120) return null;
  if (typeof p.total !== "number" || !isFinite(p.total) || p.total < 0 || p.total > 100000) return null;
  if (!Array.isArray(p.lin) || !p.lin.length || p.lin.length > 60) return null;
  const lin = [];
  for (const x of p.lin) {
    if (!x || !Number.isFinite(+x.id) || !Number.isInteger(x.q) || x.q < 1 || x.q > 99) return null;
    lin.push({ id: +x.id, q: x.q, opt: txt(x.opt, 400) });
  }
  return {
    id: idOk, tt: p.tt, name: p.name, phone: txt(p.phone, 40), clientTotal: p.total,
    pag: p.pag === "pix" ? "pix" : "local", ent: p.ent === "entrega" ? "entrega" : "retirada",
    addr: txt(p.addr, 300), obs: txt(p.obs, 300), lin,
  }; // sem "st": o status de pagamento é decidido no servidor (ver o handler)
}

// forma de pagamento conforme a LOJA (mesma regra do app): sinal ou valor total no Pix; senão paga no local
function pagamento(S, total, pedPag) {
  const pixOn = !!(S.pix || (S.cartao && S.cartaoLink));
  const sinalOn = !!S.sinal && pixOn && total > 0;
  const totalOn = !S.sinal && pixOn && total > 0;
  const pix = (sinalOn || totalOn) && pedPag === "pix";
  return { pag: pix ? "pix" : "local", tipo: totalOn ? "total" : "sinal", sinal: pix ? (totalOn ? total : Math.round(total * (+S.pct || 30)) / 100) : 0 };
}

// Horário de atendimento (Brasília, UTC-3 sem horário de verão). Sem horário definido pelo lojista = sempre aberta.
function lojaAberta(S, agora) {
  if (!S || !S.horarioOk) return true;
  const d = new Date(agora.getTime() - 3 * 3600e3);
  const dia = d.getUTCDay(), m = d.getUTCHours() * 60 + d.getUTCMinutes();
  const dias = Array.isArray(S.days) ? S.days : [];
  const ini = Number(S.start) || 0, fim = Number(S.end) || 0, is = Number(S.ibS) || 0, ie = Number(S.ibE) || 0;
  if (dias.indexOf(dia) < 0) return false;
  if (m < ini * 60 || m >= fim * 60) return false;
  if (is && ie && m >= is * 60 && m < ie * 60) return false;
  return true;
}

// Grava o pedido (com reserva de estoque na mesma transação quando há produto controlado). Compartilhado com /api/mesa.
// Devolve { id } ou { code, erro:{...} }. "o" = { id, tt, lin, ... } já validado; "base" = o documento a gravar.
async function gravaPedido(uid, S, o, base, tk) {
  const comEstoque = controlados(S, o.lin).length > 0;
  let id = o.id, gravado = false;
  if (comEstoque) {
    const R = await reservaEGrava(uid, o, base, tk);
    if (R.rej) return { code: R.rej.code, erro: R.rej.body };
    if (R.falha) return { code: 502, erro: { erro: "gravacao" } };
    if (R.id) { id = R.id; gravado = true; }
    else return { code: 503, erro: { erro: "reserva_indisponivel" } }; // FALHA FECHADA (auditoria): sem reservar não há venda confirmada de produto com estoque controlado; o app mantém o pedido na fila e reenvia
  }
  // id do documento = o id do cliente; se já existir de OUTRO pedido, usa o próximo livre (nunca descarta um pedido)
  for (let i = 0; i < 5 && !gravado; i++, id++) {
    const r = await fsx.createDoc("pf_lojas/" + uid + "/pedidos", String(id), Object.assign({ id }, base), tk);
    if (r === "ok") { gravado = true; break; }
    if (r === "existe") {
      const ex = await fsx.getDoc("pf_lojas/" + uid + "/pedidos/" + id, tk);
      if (ex && fsx.str(ex.tt) === o.tt) { gravado = true; break; } // reenvio do mesmo pedido
      continue;
    }
    return { code: 502, erro: { erro: "gravacao" } };
  }
  if (!gravado) return { code: 502, erro: { erro: "gravacao" } };
  return { id };
}

module.exports = async (req, res) => {
  const send = (code, obj) => { res.setHeader("Cache-Control", "no-store"); return res.status(code).json(obj); };
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return send(405, { erro: "metodo" }); }
  try {
    let b = req.body;
    if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = null; } }
    const slug = b && typeof b.slug === "string" ? b.slug : "";
    if (!/^[a-z0-9-]{1,40}$/.test(slug)) return send(400, { erro: "slug" });
    const o = limpa(b.pedido);
    if (!o) return send(400, { erro: "pedido_invalido" });

    // sem credencial de servidor não há gravação (falha fechada; o app guarda o pedido na fila do aparelho)
    const tk = await fsx.token();
    if (!tk) return send(503, { erro: "servidor_sem_credencial" });

    const sl = await fsx.getDocE("pf_slugs/" + encodeURIComponent(slug), tk);
    const uid = sl && fsx.str(sl.uid);
    if (!uid) return send(404, { erro: "loja_nao_encontrada" });
    const pb = await fsx.getDocE("pf_lojas_publicas/" + encodeURIComponent(uid), tk);
    if (!pb) return send(404, { erro: "loja_nao_encontrada" });
    let S;
    try { S = JSON.parse(fsx.str(pb.data) || ""); } catch (e) { return send(502, { erro: "loja_ilegivel" }); }
    if (!S || typeof S !== "object") return send(502, { erro: "loja_ilegivel" });

    // M-02: reenvio do MESMO pedido (mesmo token de rastreio), mesmo com outro id, devolve o pedido que já existe: não duplica
    const ja = await fsx.getDocE("pf_rastreio/" + o.tt, tk);
    if (ja) {
      if (fsx.str(ja.oid) !== uid) return send(409, { erro: "token_em_uso" });
      const idEx = Number(fsx.fromFs(ja.id)), pd = idEx ? await fsx.getDoc("pf_lojas/" + uid + "/pedidos/" + idEx, tk) : null;
      if (pd) return send(200, { ok: true, id: idEx, tracking_token: o.tt, total: Number(fsx.fromFs(pd.total)) || 0, sinal: Number(fsx.fromFs(pd.sinal)) || 0, repetido: true });
    }
    // M-01: limite de pedidos por origem e por loja (reenvio acima não conta)
    if (!(await limite.passa(req, slug, tk))) { res.setHeader("Retry-After", "600"); return send(429, { erro: "muitos_pedidos" }); }

    // loja fechada: vale para todo pedido, qualquer que seja a forma de pagamento
    if (!lojaAberta(S, new Date())) return send(409, { erro: "loja_fechada" });

    // preço do servidor
    let calc;
    try { calc = calcula(S, o.lin); } catch (e) { if (e instanceof Rej) return send(e.code, Object.assign({ erro: e.erro }, e.extra)); throw e; }
    if (!(o.clientTotal >= calc.total - 0.01)) return send(422, { erro: "preco_divergente", total: calc.total });
    if (calc.total > 100000) return send(422, { erro: "total_invalido" });

    // o estoque é conferido na gravação (transação ou fallback), para todo pedido
    // entrega só se o módulo estiver ligado na loja (mesma regra do app: MODS().entrega)
    const entregaOn = !!(S.mods && S.mods.entrega);
    if (o.ent === "entrega" && !entregaOn) return send(422, { erro: "entrega_indisponivel" }); // nunca vira retirada sem o cliente saber
    // sem Cozinha (KDS) ligada, o pedido não espera preparo: nasce pronto para retirar/entregar
    const kdsOn = S.modo === "cardapio" && !!(S.mods && S.mods.kds);
    const fase = kdsOn ? "novo" : "pronto";

    const pg = pagamento(S, calc.total, o.pag);
    // status de pagamento DO SERVIDOR: Pix fica pendente até a loja conferir (pend → ok); no local, o pedido já nasce liberado.
    // Nada que o cliente envie (st) decide isso, então um Pix nunca nasce "pago" por conta própria.
    o.st = pg.pag === "pix" ? "pend" : "ok";
    const base = {
      // M-06: telefone e endereço NÃO ficam no documento do pedido (a cozinha lê esse documento inteiro): vão para pedidos/{id}/contato/dados
      tt: o.tt, name: o.name, items: calc.items, total: calc.total,
      sinal: pg.sinal, tipo: pg.tipo, pag: pg.pag, ent: o.ent, obs: o.obs, lin: calc.lin, st: o.st, fase,
    };
    // entrega: nasce sem entregador; quem pega grava o próprio uid em ent_uid (regras: só pega se estiver vazio)
    if (o.ent === "entrega") base.ent_uid = "";
    if (fase === "pronto") base.prontoEm = Date.now();
    const G = await gravaPedido(uid, S, o, base, tk);
    if (G.erro) return send(G.code, G.erro);
    const id = G.id;
    // M-06: contato do cliente em subdocumento próprio (só dono, Loja e o entregador DESTA entrega leem). 3 tentativas;
    // se não gravar, desfaz o pedido e devolve erro (o app mantém o pedido na fila do aparelho e reenvia), em vez de deixar entrega sem endereço
    let cOk = false;
    for (let i = 0; i < 3 && !cOk; i++) {
      cOk = (await fsx.createDoc("pf_lojas/" + uid + "/pedidos/" + id + "/contato", "dados", { phone: o.phone, addr: o.addr }, tk)) === "ok";
    }
    if (!cOk) { try { await baixa.processa("excluir", uid, id, tk); /* apaga o pedido E devolve a reserva de estoque */ } catch (e) { /* o erro abaixo já faz o app reenviar */ } return send(502, { erro: "gravacao" }); }
    await fsx.createDoc("pf_rastreio", o.tt, {
      oid: uid, id, fase, st: o.st, ent: o.ent,
      nome: o.name.split(" ")[0].slice(0, 40), loja: txt(S.nome, 60), upd: Date.now(),
    }, tk);
    return send(200, { ok: true, id, tracking_token: o.tt, total: calc.total, sinal: pg.sinal });
  } catch (e) {
    const st = e && e.fsStatus;
    if (st === 401 || st === 403) return send(503, { erro: "firestore_sem_permissao" });
    if (st) return send(503, { erro: "firestore_indisponivel" });
    return send(502, { erro: "falha" });
  }
};
module.exports.toFs = fsx.toFs;
module.exports.limpa = limpa;
module.exports.gravaPedido = gravaPedido;
module.exports.Rej = Rej;
module.exports.txt = txt;
module.exports.lojaAberta = lojaAberta;
module.exports.calcula = calcula;
module.exports.confereEstoque = confereEstoque;
module.exports.semBaixa = semBaixa;
module.exports.somaPorProduto = somaPorProduto;
module.exports.pagamento = pagamento;
