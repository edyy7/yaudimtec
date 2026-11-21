"use strict";
// POST /api/caixa  ·  abrir, movimentar (suprimento/sangria) e fechar o caixa (auditoria M-05).
// Antes o app regravava o caixa INTEIRO a cada alteração: duas pessoas operando ao mesmo tempo apagavam o trabalho uma da outra,
// e quem tinha a função Loja podia reescrever histórico e sangrias. Agora cada operação é aplicada AQUI, em transação, sobre o
// estado que está no banco: nada se perde, o horário e o autor vêm do servidor e o histórico só cresce.
//   { acao:"abrir",  oid, abertura }
//   { acao:"mov",    oid, atualId, t:"suprimento"|"sangria", v, obs }
//   { acao:"fechar", oid, atualId, contado }      → o servidor recalcula as vendas em dinheiro a partir dos pedidos
// Cada fechamento também é gravado como documento imutável pf_lojas/{oid}/caixa/h-{id} (o estado guarda só os 30 mais recentes).
const fsx = require("./_fs");

const r2 = (n) => Math.round(n * 100) / 100;
const MAX_HIST = 30;
const txt = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");

// dono ou "Loja" da equipe aprovada (papel ped): quem opera o caixa
async function quem(oid, uid, tk) {
  if (uid === oid) return { nome: "" };
  const m = await fsx.getDoc("pf_lojas/" + encodeURIComponent(oid) + "/equipe/" + encodeURIComponent(uid), tk);
  if (!m || fsx.str(m.status) !== "aprovado" || fsx.str(m.papel) !== "ped") return null;
  return { nome: txt(fsx.str(m.nome) || "", 60) };
}

// mesma conta do app (pays / oValid / cashSales): vendas em dinheiro entre a abertura e agora
function pagamentos(o) {
  if (Array.isArray(o.pg) && o.pg.length) return o.pg;
  if (o.st === "pend") return [];
  const a = [], px = o.pag === "pix" ? (+o.sinal || 0) : 0, lo = Math.max(0, (+o.total || 0) - (o.pag === "pix" ? (+o.sinal || 0) : 0));
  if (px > 0) a.push({ v: px, fm: "pix", em: o.id });
  if (lo > 0.004) a.push({ v: lo, fm: o.fm || "", em: o.id });
  return a;
}
const valido = (o) => o.st !== "pend" && !(o.origem && !o.fechada);
async function vendasDinheiro(oid, de, ate, tk) {
  const lista = await fsx.pedidosDesde(oid, Math.max(0, de - 36 * 3600e3), 500, tk); // pedido de mesa pode ser anterior à abertura
  if (!lista) return null;
  let t = 0;
  for (const x of lista) {
    if (!valido(x.d)) continue;
    for (const p of pagamentos(x.d)) if (p && p.fm === "dinheiro" && p.em >= de && p.em <= ate) t += +p.v || 0;
  }
  return r2(t);
}

module.exports = async (req, res) => {
  const send = (code, obj) => { res.setHeader("Cache-Control", "no-store"); return res.status(code).json(obj); };
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return send(405, { erro: "metodo" }); }
  try {
    let b = req.body;
    if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = null; } }
    if (!b || typeof b !== "object") return send(400, { erro: "pedido_invalido" });
    if (!["abrir", "mov", "fechar"].includes(b.acao)) return send(400, { erro: "acao" });
    const oid = typeof b.oid === "string" && /^[A-Za-z0-9_-]{6,128}$/.test(b.oid) ? b.oid : "";
    if (!oid) return send(400, { erro: "oid" });

    const h = req.headers || {};
    const uid = await fsx.idToken(h.authorization || h.Authorization);
    if (!uid) return send(401, { erro: "nao_autenticado" });
    const tk = await fsx.token();
    if (!tk) return send(503, { erro: "servidor_sem_credencial" });
    const q = await quem(oid, uid, tk);
    if (!q) return send(403, { erro: "sem_permissao" });
    const por = { uid, nome: q.nome || txt(b.nome, 60) };

    // valida a entrada ANTES de abrir a transação
    let ab, v, obs, ct;
    if (b.acao === "abrir") { ab = Number(b.abertura); if (!(ab >= 0) || ab > 1e7) return send(400, { erro: "abertura" }); }
    if (b.acao === "mov") {
      v = Number(b.v); obs = txt(b.obs, 200).trim();
      if (b.t !== "suprimento" && b.t !== "sangria") return send(400, { erro: "tipo" });
      if (!(v > 0) || v > 1e6) return send(400, { erro: "valor" });
      if (obs.length < 3) return send(400, { erro: "descricao" });
    }
    if (b.acao === "fechar") { ct = Number(b.contado); if (!(ct >= 0) || ct > 1e8) return send(400, { erro: "contado" }); }
    if (b.acao !== "abrir" && !Number.isInteger(b.atualId)) return send(400, { erro: "atualId" });

    const path = "pf_lojas/" + oid + "/caixa/estado";
    for (let t = 0; t < 3; t++) {
      const tx = await fsx.begin(tk);
      if (!tx) return send(502, { erro: "gravacao" });
      const r = await fsx.getDocTx(path, tx, tk);
      if (!r || !r.ok) { await fsx.rollback(tx, tk); return send(502, { erro: "gravacao" }); }
      let c = { atual: null, hist: [] }, antes = 0;
      if (r.f && r.f.data) {
        try { const j = JSON.parse(fsx.str(r.f.data)); c = { atual: j.atual || null, hist: Array.isArray(j.hist) ? j.hist : [] }; antes = Number(fsx.fromFs(r.f.updated)) || 0; }
        catch (e) { await fsx.rollback(tx, tk); return send(502, { erro: "caixa_ilegivel" }); }
      }
      const conflito = async (erro) => { await fsx.rollback(tx, tk); return send(409, { erro, caixa: c, updated: antes }); }; // devolve o estado real para o app se atualizar
      const agora = Math.max(Date.now(), antes + 1); // sempre maior que a versão anterior (o app só aceita versão mais nova)
      const extra = [];
      let entrada = null;

      if (b.acao === "abrir") {
        if (c.atual) return conflito("caixa_ja_aberto");
        c.atual = { id: agora, abertura: r2(ab), aberturaEm: agora, movs: [], por };
      } else {
        if (!c.atual || c.atual.id !== b.atualId) return conflito(c.atual ? "caixa_mudou" : "caixa_fechado");
        if (b.acao === "mov") {
          c.atual.movs = Array.isArray(c.atual.movs) ? c.atual.movs : [];
          c.atual.movs.push({ t: b.t, v: r2(v), obs, por, em: agora });
        } else {
          const a = c.atual, vd = await vendasDinheiro(oid, a.aberturaEm, agora, tk);
          if (vd === null) { await fsx.rollback(tx, tk); return send(502, { erro: "vendas_indisponiveis" }); }
          let sup = 0, san = 0;
          (a.movs || []).forEach((x) => { if (x.t === "suprimento") sup += +x.v || 0; else san += +x.v || 0; });
          const sis = r2((+a.abertura || 0) + vd + sup - san);
          entrada = { id: a.id, abertura: a.abertura, aberturaEm: a.aberturaEm, movs: a.movs || [], fechadoEm: agora, fechadoPor: por, por: a.por || {}, vendasDin: vd, sistema: sis, contado: r2(ct), quebra: r2(ct - sis) };
          c.hist.unshift(entrada); c.hist = c.hist.slice(0, MAX_HIST); c.atual = null;
          extra.push(fsx.wCria("pf_lojas/" + oid + "/caixa/h-" + entrada.id, entrada)); // arquivo imutável do fechamento
        }
      }
      const w = [fsx.wDefine(path, { data: JSON.stringify(c), updated: agora, por }), ...extra];
      const cm = await fsx.commit(w, tx, tk);
      if (cm === "ok") return send(200, { ok: true, caixa: c, updated: agora, entrada });
      if (cm === "existe") return conflito("caixa_fechado");
      if (cm !== "conflito") return send(502, { erro: "gravacao" });
    }
    return send(409, { erro: "ocupado" });
  } catch (e) {
    return send(502, { erro: "falha" });
  }
};
module.exports.vendasDinheiro = vendasDinheiro;
