"use strict";
// POST /api/baixa  ·  ÚNICO caminho que DEVOLVE estoque reservado (o contador pf_lojas/{uid}/reservado/{produtoId}).
// Quem chama: o app do DONO da loja, com o idToken do Firebase no cabeçalho Authorization (equipe e clientes não passam).
//   { acao: "baixa",   ids: [pedidoId, ...] }  marca baixa:true e tira a quantidade do reservado (idempotente: 2ª vez não faz nada)
//   { acao: "excluir", ids: [pedidoId, ...] }  apaga o pedido; se ainda não tinha baixa, devolve o reservado
//   { acao: "reconciliar" }                    refaz os contadores a partir dos pedidos sem baixa (conserto de divergência)
// O estoque REAL (estoque_atual) continua sendo abatido pelo app do lojista (processStock): o app só chama "baixa"
// DEPOIS de publicar o estoque novo. Assim, no pior caso, o produto fica reservado a mais por instantes (nunca vende a mais).
// Pedido com rv:false (gravado sem reserva porque a transação falhou) não mexe no contador.
const fsx = require("./_fs");

const MAX_IDS = 50;

// soma as linhas do pedido por produto
function porProduto(d) {
  const m = {};
  for (const l of Array.isArray(d.lin) ? d.lin : []) m[l.id] = (m[l.id] || 0) + (+l.q || 0);
  return m;
}

// "ok" · "ja" (já estava feito) · "ausente" (pedido não existe) · "falha"
async function processa(acao, uid, id, tk) {
  const pedPath = "pf_lojas/" + encodeURIComponent(uid) + "/pedidos/" + encodeURIComponent(String(id));
  for (let t = 0; t < 6; t++) {
    const tx = await fsx.begin(tk);
    if (!tx) return "falha";
    const fim = async (r) => { await fsx.rollback(tx, tk); return r; };
    const rd = await fsx.getDocTx(pedPath, tx, tk);
    if (!rd.ok) return fim("falha");
    if (!rd.f) return fim(acao === "excluir" ? "ja" : "ausente");
    const d = {}; Object.keys(rd.f).forEach((k) => { d[k] = fsx.fromFs(rd.f[k]); });
    if (acao === "baixa" && d.baixa === true) return fim("ja");
    const w = [];
    // só mexe no contador se o pedido o reservou de fato (rv === true; pedido sem o campo nunca reservou) e ainda não tinha devolvido (sem baixa)
    const devolve = d.baixa !== true && d.rv === true;
    if (devolve) {
      const qs = porProduto(d);
      for (const pid of Object.keys(qs)) {
        if (!qs[pid]) continue;
        const cp = "pf_lojas/" + encodeURIComponent(uid) + "/reservado/" + encodeURIComponent(pid);
        const c = await fsx.getDocTx(cp, tx, tk);
        if (!c.ok) return fim("falha");
        if (c.f) w.push(fsx.wSoma(cp, "q", -qs[pid])); // sem contador = produto sem controle de estoque: nada a devolver
      }
    }
    w.push(acao === "baixa" ? fsx.wMarca(pedPath, { baixa: true }) : fsx.wApaga(pedPath));
    const r = await fsx.commit(w, tx, tk);
    if (r === "ok") return "ok";
    if (r === "conflito") continue;
    return "falha";
  }
  return "falha";
}

// Refaz os contadores: q = soma dos pedidos sem baixa (rv === true) dos últimos 7 dias. Não é atômico contra pedido novo
// entrando no mesmo instante; rode com a loja calma. Zera contadores que não têm mais pedido sem baixa.
async function reconcilia(uid, tk) {
  const LIM = 1000;
  const ids0 = await fsx.listaDocs("pf_lojas/" + encodeURIComponent(uid) + "/reservado", tk);
  if (!ids0) return null;
  // ATÔMICO (auditoria 5.3): abre a transação e LÊ cada contador dentro dela ANTES de consultar os pedidos. Reserva que entrar depois
  // mexe num contador já lido e derruba o commit (conflito → recusa, nada é gravado); reserva anterior já está nos pedidos consultados.
  const tx = await fsx.begin(tk);
  if (!tx) return null;
  const atuais = [];
  for (const c of ids0) {
    const r = await fsx.getDocTx("pf_lojas/" + encodeURIComponent(uid) + "/reservado/" + encodeURIComponent(c.id), tx, tk);
    if (!r.ok) return null;
    if (r.f) atuais.push({ id: c.id, d: { q: fsx.fromFs(r.f.q) } });
  }
  const lista = await fsx.pedidosDesde(uid, Date.now() - 7 * 24 * 3600e3, LIM + 1, tk);
  if (!lista) return null;
  // consulta cortada pelo limite = soma incompleta: recusa em vez de gravar contador errado
  if (lista.length > LIM) return null;
  const soma = {};
  for (const p of lista) {
    if (!p.d || p.d.baixa === true || p.d.rv !== true) continue;
    const m = porProduto(p.d);
    Object.keys(m).forEach((k) => { soma[k] = (soma[k] || 0) + m[k]; });
  }
  const alvo = [], mudou = {};
  for (const cur of atuais) {
    const novo = soma[cur.id] || 0;
    if ((+cur.d.q || 0) === novo) continue;
    // só corrige contador que já existe; produto sem controle de estoque não ganha documento à toa
    alvo.push(fsx.wDefine("pf_lojas/" + encodeURIComponent(uid) + "/reservado/" + encodeURIComponent(cur.id), { q: novo }));
    mudou[cur.id] = { de: +cur.d.q || 0, para: novo };
  }
  if (alvo.length) {
    if ((await fsx.commit(alvo, tx, tk)) !== "ok") return null;
  } else {
    try { await fsx.rollback(tx, tk); } catch (e) { /* nada a gravar */ }
  }
  return mudou;
}

module.exports = async (req, res) => {
  const send = (code, obj) => { res.setHeader("Cache-Control", "no-store"); return res.status(code).json(obj); };
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return send(405, { erro: "metodo" }); }
  try {
    let b = req.body;
    if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = null; } }
    if (!b || typeof b !== "object") return send(400, { erro: "pedido_invalido" });
    const acao = b.acao;
    if (acao !== "baixa" && acao !== "excluir" && acao !== "reconciliar") return send(400, { erro: "acao" });

    const h = req.headers || {};
    const uid = await fsx.idToken(h.authorization || h.Authorization);
    if (!uid) return send(401, { erro: "nao_autenticado" }); // o uid da loja é o do próprio dono logado: ninguém mexe na loja alheia
    const tk = await fsx.token();
    if (!tk) return send(503, { erro: "servidor_sem_credencial" });

    if (acao === "reconciliar") {
      const m = await reconcilia(uid, tk);
      return m ? send(200, { ok: true, ajustados: m }) : send(502, { erro: "falha" });
    }
    const ids = Array.isArray(b.ids) ? b.ids : [];
    if (!ids.length || ids.length > MAX_IDS || !ids.every((x) => Number.isInteger(x) && x > 0)) return send(400, { erro: "ids" });
    const out = {};
    for (const id of ids) out[id] = await processa(acao, uid, id, tk);
    const falhou = Object.keys(out).some((k) => out[k] === "falha");
    return send(falhou ? 502 : 200, { ok: !falhou, resultado: out });
  } catch (e) {
    return send(502, { erro: "falha" });
  }
};
module.exports.processa = processa;
