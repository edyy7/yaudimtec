"use strict";
// Limite de pedidos por origem (auditoria M-01): no máximo MAX pedidos por JANELA para o mesmo IP em uma mesma loja.
// Contador em pf_limites/{hash do IP+loja}-{janela}, atualizado em transação. Sem regra de leitura/escrita nas regras do Firestore:
// só o servidor acessa. FALHA ABERTA de propósito: se o contador não responder, a venda não trava (o limite é proteção, não requisito).
// Ative a política de TTL do Firestore no campo "exp" da coleção pf_limites para apagar os contadores antigos.
const crypto = require("crypto");
const fsx = require("./_fs");

const JANELA = 10 * 60e3;
const MAX = () => { const n = parseInt(process.env.PF_LIMITE_MAX, 10); return n > 0 ? n : 12; };

function ipDe(req) {
  const h = (req && req.headers) || {};
  const xf = String(h["x-forwarded-for"] || "").split(",")[0].trim();
  return xf || String(h["x-real-ip"] || "") || (req && req.socket && req.socket.remoteAddress) || "desconhecido";
}

// true = pode seguir; false = estourou o limite
async function passa(req, slug, tk) {
  if (process.env.PF_LIMITE_OFF === "1") return true;
  try {
    const agora = Date.now(), jan = Math.floor(agora / JANELA);
    const chave = crypto.createHash("sha256").update(ipDe(req) + "|" + slug).digest("hex").slice(0, 32) + "-" + jan;
    const path = "pf_limites/" + chave;
    for (let t = 0; t < 3; t++) {
      const tx = await fsx.begin(tk);
      if (!tx) return true;
      const r = await fsx.getDocTx(path, tx, tk);
      if (!r || !r.ok) { await fsx.rollback(tx, tk); return true; }
      const n = r.f ? Number(fsx.fromFs(r.f.n)) || 0 : 0;
      if (n >= MAX()) { await fsx.rollback(tx, tk); return false; }
      const c = await fsx.commit([fsx.wDefine(path, { n: n + 1, slug, exp: (jan + 2) * JANELA })], tx, tk);
      if (c === "ok") return true;
      if (c !== "conflito") return true;
    }
    return true;
  } catch (e) { return true; }
}
module.exports = { passa, ipDe, JANELA };
