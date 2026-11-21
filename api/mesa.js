"use strict";
// POST /api/mesa  ·  ÚNICO caminho de gravação do pedido de mesa/balcão e da comissão do garçom (auditoria A-03 e A-04).
// Quem chama: o app logado (dono ou funcionário aprovado), com o idToken do Firebase em Authorization. As regras do Firestore
// NÃO deixam mais o garçom gravar pedido nem comissão direto: o preço, o estoque e a comissão são calculados aqui.
//   { acao:"pedido",   oid, pedido:{ id, tt, mesa, obs, pess:[{ nome, lin:[{ id, q }] }] } }
//        → recalcula o preço com a tabela da loja, confere e reserva o estoque (mesma transação do /api/pedido) e grava.
//   { acao:"comissao", oid, ids:[idDoPedido, ...] }
//        → lê os pedidos JÁ FECHADOS no banco, usa o total gravado pelo servidor e o % da loja; um pedido só gera comissão uma vez.
const crypto = require("crypto");
const fsx = require("./_fs");
const ped = require("./pedido");

const { Rej, txt } = ped;
const r2 = (n) => Math.round(n * 100) / 100;
const MAX_PESSOAS = 30, MAX_LINHAS = 60, JANELA_ID = 10 * 60e3;
const PAPEL_PEDIDO = ["mesas"];            // quem lança pedido de mesa/balcão
const PAPEL_COMISSAO = ["mesas", "ped"];   // quem encerra conta (garçom ou Loja da equipe)

// papel de quem chama: "dono" | papel da equipe aprovada | null. Devolve também o nome gravado pelo dono na equipe.
async function quem(oid, uid, tk) {
  if (uid === oid) return { papel: "dono", nome: "" };
  const m = await fsx.getDoc("pf_lojas/" + encodeURIComponent(oid) + "/equipe/" + encodeURIComponent(uid), tk);
  if (!m || fsx.str(m.status) !== "aprovado") return null;
  return { papel: fsx.str(m.papel) || "", nome: txt(fsx.str(m.nome) || "", 60) };
}

// pedido de mesa recebido do aparelho → só nomes, ids de produto e quantidades; nada de dinheiro
function limpaMesa(p) {
  if (!p || typeof p !== "object") return null;
  if (typeof p.tt !== "string" || !/^[a-f0-9]{32}$/.test(p.tt)) return null;
  const mesa = txt(p.mesa, 40).trim();
  if (!mesa) return null;
  if (!Array.isArray(p.pess) || !p.pess.length || p.pess.length > MAX_PESSOAS) return null;
  const pess = [];
  for (const x of p.pess) {
    if (!x || !Array.isArray(x.lin) || !x.lin.length || x.lin.length > MAX_LINHAS) return null;
    const lin = [];
    for (const l of x.lin) {
      if (!l || !Number.isFinite(+l.id) || !Number.isInteger(l.q) || l.q < 1 || l.q > 99) return null;
      lin.push({ id: +l.id, q: l.q });
    }
    pess.push({ nome: txt(x.nome, 24).trim() || "Pessoa", lin });
  }
  // o horário vem do servidor; o id do cliente só vale como chave de reenvio e dentro de uma janela curta (auditoria M-03)
  const agora = Date.now();
  const id = Number.isInteger(p.id) && Math.abs(p.id - agora) <= JANELA_ID ? p.id : agora;
  return { id, tt: p.tt, mesa, obs: txt(p.obs, 300), pess };
}

async function pedido(res, send, oid, quemE, uid, b, S, tk) {
  if (!PAPEL_PEDIDO.includes(quemE.papel) && quemE.papel !== "dono") return send(403, { erro: "sem_permissao" });
  const p = limpaMesa(b.pedido);
  if (!p) return send(400, { erro: "pedido_invalido" });
  const svcs = Array.isArray(S.services) ? S.services : [];
  const agg = {}, pess = [], itens = [];
  let total = 0;
  const unica = p.pess.length === 1;
  for (const x of p.pess) {
    let pt = 0;
    for (const l of x.lin) {
      const sv = svcs.filter((s) => s && s.id == l.id)[0];
      if (!sv || !isFinite(+sv.price)) return send(422, { erro: "produto_invalido", id: l.id });
      pt += l.q * (+sv.price || 0);
      agg[l.id] = (agg[l.id] || 0) + l.q;
      itens.push((unica ? "" : "(" + x.nome + ") ") + l.q + "x " + txt(sv.name, 120));
    }
    pt = r2(pt);
    pess.push({ nome: x.nome, lin: x.lin, total: pt });
    total += pt;
  }
  total = r2(total);
  if (!(total >= 0) || total > 100000) return send(422, { erro: "total_invalido" });
  const lin = Object.keys(agg).map((k) => ({ id: +k, q: agg[k] }));
  const kdsOn = !!(S.mods && S.mods.kds);
  const fase = kdsOn ? "novo" : "pronto";
  const origem = p.mesa === "Balcão" ? "balcao" : "mesa";
  const base = {
    tt: p.tt, name: p.mesa, phone: "", items: itens.join("; "), total, sinal: 0, tipo: "total", pag: "local", ent: "local",
    addr: "", obs: p.obs, lin, pess, st: "ok", fase, origem, mesa: p.mesa, garcom_uid: uid, garcom_nome: quemE.nome || txt(b.nome, 40),
  };
  if (fase === "pronto") base.prontoEm = Date.now();
  const o = { id: p.id, tt: p.tt, lin, st: "ok" };
  const G = await ped.gravaPedido(oid, S, o, base, tk);
  if (G.erro) return send(G.code, G.erro);
  return send(200, { ok: true, id: G.id, pedido: Object.assign({ id: G.id }, base) });
}

async function comissao(res, send, oid, quemE, uid, b, S, tk) {
  if (!PAPEL_COMISSAO.includes(quemE.papel) && quemE.papel !== "dono") return send(403, { erro: "sem_permissao" });
  const ids = Array.isArray(b.ids) ? b.ids : [];
  if (!ids.length || ids.length > 50 || !ids.every((x) => Number.isInteger(x) && x > 0)) return send(400, { erro: "ids" });
  const pct = +S.comGarcom >= 0 ? +S.comGarcom : 10; // mesma regra do app; o % vem da LOJA, nunca do aparelho
  if (!(pct > 0)) return send(200, { ok: true, minha: 0, criadas: 0 });
  const grupos = {};
  let mesa = "";
  for (const id of [...new Set(ids)]) {
    const f = await fsx.getDoc("pf_lojas/" + encodeURIComponent(oid) + "/pedidos/" + id, tk);
    if (!f) return send(404, { erro: "pedido_inexistente", id });
    const d = {}; Object.keys(f).forEach((k) => { d[k] = fsx.fromFs(f[k]); });
    if (d.origem !== "mesa" && d.origem !== "balcao") return send(422, { erro: "pedido_sem_comissao", id });
    if (d.fechada !== true) return send(422, { erro: "conta_aberta", id }); // só pedido de conta já encerrada
    const gid = String(d.garcom_uid || "");
    if (!gid || gid === oid) continue; // pedido do próprio dono não gera comissão
    if (quemE.papel === "mesas" && gid !== uid) return send(403, { erro: "pedido_de_outro_garcom", id });
    const ja = await fsx.getDoc("pf_lojas/" + encodeURIComponent(oid) + "/comissoes_pedidos/" + id, tk);
    if (ja) continue; // este pedido já gerou comissão: nunca duas vezes
    const g = grupos[gid] = grupos[gid] || { base: 0, nome: txt(d.garcom_nome, 60), ids: [] };
    g.base += +d.total || 0; g.ids.push(id);
    mesa = mesa || txt(d.mesa, 40);
  }
  const agora = Date.now(), w = [];
  let minha = 0, k = 0;
  for (const gid of Object.keys(grupos)) {
    const g = grupos[gid], base = r2(g.base), valor = r2(base * pct / 100);
    if (!(valor > 0)) continue;
    const cid = agora + "-" + (++k) + "-" + crypto.randomBytes(3).toString("hex"); // único mesmo com duas contas fechadas no mesmo instante
    if (gid === uid) minha += valor;
    w.push(fsx.wCria("pf_lojas/" + oid + "/comissoes/" + cid, {
      id: cid, garcom_uid: gid, garcom: g.nome || "Garçom", mesa, base, pct, valor, em: agora, fechadaPor: quemE.nome || "", pedidos: g.ids,
    }));
    g.ids.forEach((pid) => w.push(fsx.wCria("pf_lojas/" + oid + "/comissoes_pedidos/" + pid, { cid, em: agora }))); // marca: 1 comissão por pedido
  }
  if (!w.length) return send(200, { ok: true, minha: 0, criadas: 0 });
  const tx = await fsx.begin(tk);
  if (!tx) return send(502, { erro: "gravacao" });
  const r = await fsx.commit(w, tx, tk);
  if (r === "existe" || r === "conflito") return send(409, { erro: "comissao_duplicada" });
  if (r !== "ok") return send(502, { erro: "gravacao" });
  return send(200, { ok: true, minha: r2(minha), criadas: Object.keys(grupos).length });
}

module.exports = async (req, res) => {
  const send = (code, obj) => { res.setHeader("Cache-Control", "no-store"); return res.status(code).json(obj); };
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return send(405, { erro: "metodo" }); }
  try {
    let b = req.body;
    if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = null; } }
    if (!b || typeof b !== "object") return send(400, { erro: "pedido_invalido" });
    if (b.acao !== "pedido" && b.acao !== "comissao") return send(400, { erro: "acao" });
    const oid = typeof b.oid === "string" && /^[A-Za-z0-9_-]{6,128}$/.test(b.oid) ? b.oid : "";
    if (!oid) return send(400, { erro: "oid" });

    const h = req.headers || {};
    const uid = await fsx.idToken(h.authorization || h.Authorization);
    if (!uid) return send(401, { erro: "nao_autenticado" });
    const tk = await fsx.token();
    if (!tk) return send(503, { erro: "servidor_sem_credencial" });

    const quemE = await quem(oid, uid, tk);
    if (!quemE) return send(403, { erro: "sem_permissao" }); // não é o dono nem funcionário aprovado desta loja

    const pb = await fsx.getDoc("pf_lojas_publicas/" + encodeURIComponent(oid), tk);
    if (!pb) return send(404, { erro: "loja_nao_encontrada" });
    let S;
    try { S = JSON.parse(fsx.str(pb.data) || ""); } catch (e) { return send(502, { erro: "loja_ilegivel" }); }
    if (!S || typeof S !== "object") return send(502, { erro: "loja_ilegivel" });

    if (b.acao === "pedido") return await pedido(res, send, oid, quemE, uid, b, S, tk);
    return await comissao(res, send, oid, quemE, uid, b, S, tk);
  } catch (e) {
    if (e instanceof Rej) return send(e.code, Object.assign({ erro: e.erro }, e.extra));
    return send(502, { erro: "falha" });
  }
};
module.exports.limpaMesa = limpaMesa;
