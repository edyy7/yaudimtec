/* Yaudimtec: uso offline do aplicativo (guarda o app e as fotos no aparelho) */
const V = "pf-v8";
const ROLE = /^\/app\/(adm|loja|cozinha|garcom|entregas)\//;
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(V).then((c) => c.addAll(["/", "/og-default.png"])).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((x) => x !== V).map((x) => caches.delete(x)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);
  if (u.origin !== location.origin) return; // só o próprio site; o banco (Firebase) tem a fila própria
  if (r.mode === "navigate") {
    e.respondWith(
      fetch(r).then((res) => { if (res.ok) { const cp = res.clone(); caches.open(V).then((c) => c.put(r, cp)); } return res; }) // só guarda resposta boa (não cacheia 404/500)
        .catch(() => caches.match(r)
          .then((m) => m || caches.match(r, { ignoreSearch: true })) // /app/adm/ sem ?op= acha o /app/adm/?op=adm
          .then((m) => { if (m) return m; const mm = ROLE.exec(u.pathname); return mm ? caches.match("/app/" + mm[1] + "/?op=" + ({adm:"adm",loja:"ped",cozinha:"kds",garcom:"garcom",entregas:"ent"})[mm[1]]) : null; }) // offline: volta para o PRÓPRIO perfil, nunca para a home
          .then((m) => m || caches.match("/")))
    );
    return;
  }
  if (u.pathname.startsWith("/img/") || u.pathname.startsWith("/icons/") || u.pathname === "/og-default.png" || u.pathname === "/manifest.webmanifest" || u.pathname === "/manifest-criador.webmanifest" || /^\/manifest-[a-z]+\.json$/.test(u.pathname)) {
    e.respondWith(caches.match(r).then((m) => m || fetch(r).then((res) => { if (res.ok) { const cp = res.clone(); caches.open(V).then((c) => c.put(r, cp)); } return res; })));
  }
});
