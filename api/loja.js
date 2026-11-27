"use strict";
// Página da loja (espacopedefacil.vercel.app/nome-da-loja) com o card do WhatsApp certo.
// Lê a loja no Firestore pela API REST (as coleções pf_slugs e pf_lojas_publicas têm leitura pública nas regras).
const fs = require("fs");
const path = require("path");
const lib = require("./_lib");

const PROJECT = process.env.PF_PROJECT_ID || "delivery-67d14";
const API_KEY = process.env.PF_API_KEY || "AIzaSyCXq4-VbJUwypuC6H5jzw5cri5N4fqo-sw"; // chave pública do app web (a mesma do index.html)
const BASE = "https://firestore.googleapis.com/v1/projects/" + PROJECT + "/databases/(default)/documents/";

let TEMPLATE = null;
function template() {
  if (TEMPLATE) return TEMPLATE;
  for (const p of [path.join(__dirname, "..", "index.html"), path.join(process.cwd(), "index.html")]) {
    try { TEMPLATE = fs.readFileSync(p, "utf8"); return TEMPLATE; } catch (e) { /* tenta o próximo */ }
  }
  throw new Error("index.html não encontrado");
}

async function getDoc(docPath, origin) {
  // o Referer garante que chaves restritas por site aceitem a chamada do servidor
  const r = await fetch(BASE + docPath + "?key=" + API_KEY, { headers: { Referer: origin + "/" } });
  if (!r.ok) return null;
  const j = await r.json();
  return j.fields || null;
}
const str = (f) => (f && f.stringValue != null ? f.stringValue : null);

async function loadStore(slug, origin) {
  const s = await getDoc("pf_slugs/" + encodeURIComponent(slug), origin);
  const uid = s && str(s.uid);
  if (!uid) return null;
  const l = await getDoc("pf_lojas_publicas/" + encodeURIComponent(uid), origin);
  const data = l && str(l.data);
  return data ? lib.parseStore({ data }) : null;
}

const one = (v) => String(Array.isArray(v) ? v[0] : v || "");

module.exports = async (req, res) => {
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const origin = "https://" + host;
  try {
    const q = req.query || {};
    if (q.og) { // imagem do card: /_og/<slug>
      const slug = lib.slugFromPath("/" + one(q.og));
      const S = slug ? await loadStore(slug, origin) : null;
      const img = S && lib.dataUri(S.cover || S.logo);
      if (!img) { res.statusCode = 302; res.setHeader("Location", "/og-default.png"); return res.end(); }
      res.setHeader("Content-Type", img.type);
      res.setHeader("Cache-Control", "public, max-age=600, s-maxage=3600");
      return res.status(200).send(img.buf);
    }
    if (q.manifest) { // app do Cliente: /_manifest/<slug>
      const ms = lib.slugFromPath("/" + one(q.manifest));
      const MS = ms ? await loadStore(ms, origin) : null;
      if (!MS) { res.statusCode = 404; return res.end("{}"); }
      const nome = String(MS.nome || "").trim() || "Loja";
      const cor = MS.theme && /^#[0-9a-fA-F]{6}$/.test(MS.theme.c1 || "") ? MS.theme.c1 : "#047857";
      res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600");
      return res.status(200).send(JSON.stringify({
        id: "/" + ms, name: nome, short_name: nome.slice(0, 24), description: "Peça de " + nome + " pelo aplicativo.",
        start_url: "/" + ms, scope: "/" + ms, display: "standalone", orientation: "portrait",
        background_color: "#ffffff", theme_color: cor, lang: "pt-BR",
        icons: [
          { src: "/icons/cliente-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/cliente-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/cliente-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      }));
    }
    const slug = lib.slugFromPath("/" + one(q.slug));
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    if (!slug) {
      res.setHeader("Cache-Control", "public, max-age=300, s-maxage=600");
      return res.status(200).send(template());
    }
    const S = await loadStore(slug, origin);
    if (!S) return res.status(404).send(template()); // o app mostra "Loja não encontrada"
    res.setHeader("Cache-Control", "public, max-age=120, s-maxage=300");
    return res.status(200).send(lib.buildStoreHtml(template(), S, slug, origin));
  } catch (e) {
    console.error(e);
    try { res.setHeader("Content-Type", "text/html; charset=utf-8"); return res.status(200).send(template()); }
    catch (e2) { return res.status(500).send("Erro ao carregar a página."); }
  }
};
