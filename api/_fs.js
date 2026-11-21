"use strict";
// Acesso ao Firestore pela API REST COM credencial de servidor (conta de serviço).
// Só o servidor grava pedidos: as regras do Firestore negam gravação de cliente em pedidos e rastreio.
// Sem dependências: o JWT é assinado com o módulo crypto do Node.
const crypto = require("crypto");

function credencial() {
  let raw = process.env.PF_SA_JSON || "";
  if (!raw) return null;
  try {
    if (raw.trim()[0] !== "{") raw = Buffer.from(raw, "base64").toString("utf8");
    const j = JSON.parse(raw);
    return j && j.client_email && j.private_key ? j : null;
  } catch (e) { return null; }
}
const b64u = (b) => Buffer.from(b).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

// Emulador do Firestore (só para testes locais): com FIRESTORE_EMULATOR_HOST definido, fala com o emulador em vez da nuvem.
// Nunca vale em produção na Vercel (VERCEL_ENV=production ignora a variável). O emulador não precisa de conta de serviço:
// "Bearer owner" é o jeito documentado de ele ignorar as regras de segurança.
const EMU = () => (process.env.VERCEL_ENV === "production" ? "" : String(process.env.FIRESTORE_EMULATOR_HOST || "").trim());
const projId = () => { const c = credencial(); return process.env.PF_PROJECT_ID || (c && c.project_id) || (EMU() ? "demo-pedefacil" : "delivery-67d14"); };

let CACHE = null;
function _reset() { CACHE = null; }
async function token() {
  if (EMU()) return "owner";
  const c = credencial();
  if (!c) return null;
  const now = Math.floor(Date.now() / 1000);
  if (CACHE && CACHE.exp - 60 > now && CACHE.mail === c.client_email) return CACHE.tk;
  const aud = c.token_uri || "https://oauth2.googleapis.com/token";
  const head = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64u(JSON.stringify({ iss: c.client_email, scope: "https://www.googleapis.com/auth/datastore", aud, iat: now, exp: now + 3600 }));
  const sig = crypto.createSign("RSA-SHA256").update(head + "." + body).sign(c.private_key);
  const r = await fetch(aud, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=" + encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer") + "&assertion=" + head + "." + body + "." + b64u(sig),
  });
  if (!r.ok) return null;
  const j = await r.json();
  if (!j.access_token) return null;
  CACHE = { tk: j.access_token, exp: now + (+j.expires_in || 3600), mail: c.client_email };
  return CACHE.tk;
}
function base() {
  const raizApi = EMU() ? "http://" + EMU() + "/v1/" : "https://firestore.googleapis.com/v1/";
  return raizApi + "projects/" + projId() + "/databases/(default)/documents/";
}
function toFs(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFs) } };
  const f = {};
  Object.keys(v).forEach((k) => { if (v[k] !== undefined) f[k] = toFs(v[k]); });
  return { mapValue: { fields: f } };
}
const fields = (o) => toFs(o).mapValue.fields;
const str = (f) => (f && f.stringValue != null ? f.stringValue : null);

async function getDoc(path, tk) {
  const r = await fetch(base() + path, { headers: { Authorization: "Bearer " + tk } });
  if (!r.ok) return null;
  const j = await r.json();
  return j.fields || null;
}
// "ok" criado · "existe" já havia um documento com esse id · "erro"
async function createDoc(col, id, obj, tk) {
  const r = await fetch(base() + col + "?documentId=" + encodeURIComponent(id), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + tk },
    body: JSON.stringify({ fields: fields(obj) }),
  });
  if (r.ok) return "ok";
  return r.status === 409 ? "existe" : "erro";
}
// valor do Firestore -> JS (inverso de toFs)
function fromFs(v) {
  if (!v || typeof v !== "object") return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("arrayValue" in v) return ((v.arrayValue && v.arrayValue.values) || []).map(fromFs);
  if ("mapValue" in v) { const o = {}, f = (v.mapValue && v.mapValue.fields) || {}; Object.keys(f).forEach((k) => { o[k] = fromFs(f[k]); }); return o; }
  return null;
}
// hora de criação normalizada (fração com 9 dígitos) para ordenar como texto
function tsKey(t) {
  const m = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d+))?Z?$/.exec(String(t || ""));
  return m ? m[1] + "." + ((m[2] || "") + "000000000").slice(0, 9) + "Z" : "";
}
// pedidos de uma loja com id >= minId (id = hora do pedido em ms), os MAIS RECENTES primeiro (se passar do limite, corta os antigos).
// Devolve [{ id, createTime, d }] ou null se falhar.
async function pedidosDesde(uid, minId, limit, tk) {
  try {
    const r = await fetch(base() + "pf_lojas/" + encodeURIComponent(uid) + ":runQuery", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + tk },
      body: JSON.stringify({ structuredQuery: {
        from: [{ collectionId: "pedidos" }],
        where: { fieldFilter: { field: { fieldPath: "id" }, op: "GREATER_THAN_OR_EQUAL", value: { integerValue: String(minId) } } },
        orderBy: [{ field: { fieldPath: "id" }, direction: "DESCENDING" }],
        limit,
      } }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return (Array.isArray(j) ? j : []).filter((x) => x && x.document).map((x) => {
      const d = {}; Object.keys(x.document.fields || {}).forEach((k) => { d[k] = fromFs(x.document.fields[k]); });
      return { id: Number(d.id), createTime: tsKey(x.document.createTime), d };
    });
  } catch (e) { return null; }
}
// apaga um documento (usado só para desfazer um pedido recusado na conferência de estoque)
async function delDoc(path, tk) {
  try {
    const r = await fetch(base() + path, { method: "DELETE", headers: { Authorization: "Bearer " + tk } });
    return r.ok;
  } catch (e) { return false; }
}

// ---------- transação REST (sem SDK): beginTransaction → leituras com o id → commit atômico ----------
const API = "https://firestore.googleapis.com/v1/";
const hdr = (tk) => ({ "Content-Type": "application/json", Authorization: "Bearer " + tk });
const raiz = () => base().replace(/\/$/, ""); // .../documents
const nome = (path) => "projects/" + projId() + "/databases/(default)/documents/" + path; // nome completo do documento, como o commit exige
async function begin(tk) {
  try {
    const r = await fetch(raiz() + ":beginTransaction", { method: "POST", headers: hdr(tk), body: JSON.stringify({ options: { readWrite: {} } }) });
    if (!r.ok) return null;
    const j = await r.json();
    return (j && j.transaction) || null;
  } catch (e) { return null; }
}
// solta a transação (melhor esforço; ela também expira sozinha)
async function rollback(tx, tk) {
  try { await fetch(raiz() + ":rollback", { method: "POST", headers: hdr(tk), body: JSON.stringify({ transaction: tx }) }); } catch (e) { /* expira sozinha */ }
}
// lê dentro da transação: { ok:true, f: campos|null (não existe) } ou { ok:false } se falhar
async function getDocTx(path, tx, tk) {
  try {
    const r = await fetch(base() + path + "?transaction=" + encodeURIComponent(tx), { headers: { Authorization: "Bearer " + tk } });
    if (r.status === 404) return { ok: true, f: null };
    if (!r.ok) return { ok: false };
    const j = await r.json();
    return { ok: true, f: j.fields || {} };
  } catch (e) { return { ok: false }; }
}
// "ok" · "conflito" (ABORTED: outra transação passou na frente, repita) · "existe" (ALREADY_EXISTS) · "erro"
async function commit(writes, tx, tk) {
  try {
    const r = await fetch(raiz() + ":commit", { method: "POST", headers: hdr(tk), body: JSON.stringify({ transaction: tx, writes }) });
    if (r.ok) return "ok";
    let st = "";
    try { const j = await r.json(); st = (j && j.error && j.error.status) || ""; } catch (e) { /* sem corpo */ }
    if (st === "ABORTED") return "conflito";
    if (st === "ALREADY_EXISTS") return "existe";
    return "erro";
  } catch (e) { return "erro"; }
}
// montadores de escrita para o commit
const wCria = (path, obj) => ({ update: { name: nome(path), fields: fields(obj) }, currentDocument: { exists: false } });
const wApaga = (path) => ({ delete: nome(path), currentDocument: { exists: true } });
const wMarca = (path, obj) => ({ update: { name: nome(path), fields: fields(obj) }, updateMask: { fieldPaths: Object.keys(obj) }, currentDocument: { exists: true } });
// soma atômica no servidor (n pode ser negativo): não depende do valor lido
const wSoma = (path, campo, n) => ({ update: { name: nome(path) }, updateMask: { fieldPaths: [] }, updateTransforms: [{ fieldPath: campo, increment: { integerValue: String(n) } }], currentDocument: { exists: true } });
const wDefine = (path, obj) => ({ update: { name: nome(path), fields: fields(obj) } }); // cria ou substitui

// quem está chamando? Confere o idToken do Firebase Auth (a chave web é pública por definição) e devolve o uid, ou null
async function idToken(bearer) {
  const t = /^Bearer\s+([\w.-]{20,4000})$/.exec(String(bearer || ""));
  if (!t) return null;
  const key = process.env.PF_WEB_API_KEY || "AIzaSyCXq4-VbJUwypuC6H5jzw5cri5N4fqo-sw";
  try {
    const r = await fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + encodeURIComponent(key), {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: t[1] }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const u = j && Array.isArray(j.users) ? j.users[0] : null;
    return u && u.localId && !u.disabled ? String(u.localId) : null;
  } catch (e) { return null; }
}
// lista os documentos de uma coleção (até 300): [{ id, d }] ou null se falhar
async function listaDocs(col, tk) {
  try {
    const r = await fetch(base() + col + "?pageSize=300", { headers: { Authorization: "Bearer " + tk } });
    if (!r.ok) return null;
    const j = await r.json();
    return (j.documents || []).map((x) => {
      const d = {}; Object.keys(x.fields || {}).forEach((k) => { d[k] = fromFs(x.fields[k]); });
      return { id: String(x.name).split("/").pop(), d };
    });
  } catch (e) { return null; }
}
module.exports = { begin, rollback, getDocTx, commit, wCria, wApaga, wMarca, wSoma, wDefine, idToken, listaDocs, nome, token, base, toFs, fromFs, tsKey, fields, str, getDoc, createDoc, pedidosDesde, delDoc, _reset };
