// Lógica pura (sem dependências do Firebase) para gerar o card de compartilhamento.
"use strict";

const RESERVED = new Set(["_og", "index", "index.html", "favicon.ico", "og-default.png", "robots.txt", "sitemap.xml", "admin", "api", "www", "loja", "login", "superadmin", "criador", "equipe", "gestao", "app", "afiliado", "afiliado.html"]);

function slugFromPath(p) {
  const seg = String(p || "/").split("/").filter(Boolean)[0] || "";
  const s = seg.toLowerCase();
  return /^[a-z0-9-]{1,40}$/.test(s) && !RESERVED.has(s) ? s : "";
}

function esc(x) {
  return String(x == null ? "" : x).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function parseStore(doc) {
  try { return JSON.parse(doc && doc.data); } catch (e) { return null; }
}

// Aceita só imagem em base64 (png/jpeg/webp) de até 600 KB
function dataUri(u) {
  const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(u || ""));
  if (!m) return null;
  const buf = Buffer.from(m[2], "base64");
  return buf.length > 0 && buf.length <= 600 * 1024 ? { type: m[1], buf } : null;
}

// Escolhe a imagem do card: URL https da loja, ou imagem embutida servida em /_og/<slug>, ou a padrão
function imageFor(S, origin, slug) {
  const u = (S && (S.cover || S.logo)) || "";
  if (/^https:\/\//i.test(u)) return u;
  if (dataUri(u)) return origin + "/_og/" + slug;
  return origin + "/og-default.png";
}

function ogBlock({ title, desc, url, image }) {
  return [
    "<!--OG-->",
    "<title>" + esc(title) + "</title>",
    '<meta name="description" content="' + esc(desc) + '">',
    '<meta property="og:site_name" content="Yaudimtec">',
    '<meta property="og:title" content="' + esc(title) + '">',
    '<meta property="og:description" content="' + esc(desc) + '">',
    '<meta property="og:type" content="website">',
    '<meta property="og:url" content="' + esc(url) + '">',
    '<meta property="og:image" content="' + esc(image) + '">',
    '<meta property="og:image:alt" content="' + esc(title) + '">',
    '<meta name="twitter:card" content="summary_large_image">',
    "<!--/OG-->",
  ].join("\n");
}

function inject(template, block) {
  return template.replace(/<!--OG-->[\s\S]*?<!--\/OG-->/, () => block);
}

function buildStoreHtml(template, S, slug, origin) {
  const nome = String((S && S.nome) || "").trim() || "Loja";
  return inject(template, ogBlock({
    title: nome + " | Yaudimtec",
    desc: "Faça seu pedido online em " + nome + ". Rápido, direto no WhatsApp e sem complicação.",
    url: origin + "/" + slug,
    image: imageFor(S, origin, slug),
  }));
}

module.exports = { slugFromPath, esc, parseStore, dataUri, imageFor, ogBlock, inject, buildStoreHtml, RESERVED };
