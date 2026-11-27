"use strict";
// Testes do plano B do pedido (Yaudimtec): rode com  node tests/fallback.test.js
// Pega as funções REAIS de dentro dos index.html e roda com um servidor e um banco simulados.
// As regras do Firestore (firestore.rules) são conferidas só por leitura do texto: não existe emulador aqui.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const HTMLS = ["index.html", "app/adm/index.html", "app/loja/index.html", "app/cozinha/index.html", "app/garcom/index.html", "app/entregas/index.html"];
let ok = 0, falha = 0;
const falhas = [];
function t(nome, fn) {
  try { fn(); ok++; console.log("  ok   " + nome); }
  catch (e) { falha++; falhas.push(nome); console.log("  FALHA " + nome + "\n         " + (e && e.message)); }
}
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || "") + " esperado " + JSON.stringify(b) + " veio " + JSON.stringify(a)); }
function yes(c, m) { if (!c) throw new Error(m || "condição falsa"); }

// pega "function nome(...){...}" inteira, contando chaves e pulando textos entre aspas
function pegaFuncao(src, nome) {
  const i = src.indexOf("function " + nome + "(");
  if (i < 0) throw new Error("não achei a função " + nome);
  let j = src.indexOf("{", i), d = 0, q = "";
  for (; j < src.length; j++) {
    const c = src[j];
    if (q) { if (c === "\\") { j++; continue; } if (c === q) q = ""; continue; }
    if (c === '"' || c === "'" || c === "`") { q = c; continue; }
    if (c === "{") d++;
    if (c === "}") { d--; if (d === 0) return src.slice(i, j + 1); }
  }
  throw new Error("função " + nome + " não fecha");
}
function pegaVar(src, nome) {
  const i = src.indexOf("var " + nome + "=");
  if (i < 0) throw new Error("não achei a var " + nome);
  return src.slice(i, src.indexOf(";\n", i) + 1);
}

const htmlSrc = {};
HTMLS.forEach((f) => { htmlSrc[f] = fs.readFileSync(path.join(ROOT, f), "utf8"); });
const rules = fs.readFileSync(path.join(ROOT, "firestore.rules"), "utf8");

console.log("\n[1] Os 6 arquivos do app têm o mesmo plano B");
const nomes = ["pfServidorFalhou", "pfMontaDireto", "pfDireto", "pfSend", "pfFlush", "pfRetry"];
HTMLS.forEach((f) => {
  t(f + ": funções do plano B iguais ao index.html da raiz", () => {
    nomes.forEach((n) => eq(pegaFuncao(htmlSrc[f], n), pegaFuncao(htmlSrc["index.html"], n), n));
    eq(pegaVar(htmlSrc[f], "PF_DIRETO_KEYS"), pegaVar(htmlSrc["index.html"], "PF_DIRETO_KEYS"));
  });
  t(f + ": scripts continuam com sintaxe válida", () => {
    const re = /<script(?![^>]*application\/json)[^>]*>([\s\S]*?)<\/script>/g;
    let m, n = 0;
    while ((m = re.exec(htmlSrc[f]))) { if (m[1].trim()) { new vm.Script(m[1], { filename: f }); n++; } }
    yes(n > 0, "nenhum script");
  });
  t(f + ": aviso 'sem conferência do servidor' presente", () => yes(htmlSrc[f].includes("Enviado sem conferência do servidor"), "falta o aviso"));
});

console.log("\n[2] Comportamento do envio (servidor e banco simulados)");
function ambiente(opc) {
  const src = htmlSrc["index.html"];
  const log = { posts: [], sets: [], fila: [], backs: [], dels: [], refresh: 0 };
  let fila = (opc.fila || []).slice();
  const sb = {
    TENANT: opc.semTenant ? null : { uid: "UID1", slug: "loja-teste" },
    C: { cart: [1], oid: 1, tt: "ab".repeat(16) },
    S: { nome: "Loja Teste" },
    SRVCLOSED: false, TRKQ: {}, TRKR: {}, PFB: false,
    navigator: { onLine: true },
    render() {}, alert() {}, setTimeout(f) { f(); },
    pfBack(m) { log.backs.push(m); },
    pfRefresh(cb) { log.refresh++; cb(); },
    pfAjusteEstoque() { return "ajustado"; },
    pfPost(slug, o, cb) { log.posts.push(o.id); const r = opc.api; cb(r[0], r[1] || {}); },
    DB: { set(p, v, cb) { log.sets.push([p, v]); cb(opc.db); } },
    PFQ: {
      add(it, cb) { log.fila.push(it); if (cb) cb(); },
      all(cb) { cb(fila.slice()); },
      del(tt, cb) { log.dels.push(tt); fila = fila.filter((x) => x.tt !== tt); if (cb) cb(); },
    },
  };
  sb.pfFlushPendente = null;
  const ctx = vm.createContext(sb);
  vm.runInContext([pegaVar(src, "PF_DIRETO_KEYS"), pegaFuncao(src, "pfRetry"), pegaFuncao(src, "pfServidorFalhou"), pegaFuncao(src, "pfMontaDireto"),
    pegaFuncao(src, "pfDireto"), pegaFuncao(src, "pfSend"), pegaFuncao(src, "pfFlush")].join("\n"), ctx);
  return { ctx, log, sb };
}
function pedido(extra) {
  return Object.assign({ id: 1700000000000, tt: "ab".repeat(16), name: "Maria Souza", phone: "27999990000", items: "1x Pizza", total: 50, sinal: 0,
    tipo: "sinal", pag: "local", ent: "entrega", addr: "Rua A 10", obs: undefined, lin: [{ id: 1, q: 1, opt: "" }], st: "ok", fase: "novo" }, extra || {});
}

t("servidor responde 200: não grava direto e não enfileira", () => {
  const a = ambiente({ api: [200, { ok: true }], db: true }); a.ctx.pfSend(pedido());
  eq(a.log.sets.length, 0); eq(a.log.fila.length, 0); eq(a.log.backs.length, 0);
});
[503, 502, 500, 404].forEach((cod) => {
  t("servidor responde " + cod + ": grava direto (pedido + rastreio) e não mostra erro", () => {
    const a = ambiente({ api: [cod, {}], db: true }); a.ctx.pfSend(pedido());
    eq(a.log.sets.map((x) => x[0]), ["lojas/UID1/pedidos/1700000000000", "rastreio/" + "ab".repeat(16)]);
    eq(a.log.backs.length, 0); eq(a.log.fila.length, 0);
  });
});
t("pedido do plano B leva fb=true e telefone/endereço (como o Fácil)", () => {
  const a = ambiente({ api: [503, {}], db: true }); a.ctx.pfSend(pedido());
  const d = a.log.sets[0][1];
  eq(d.fb, true); eq(d.phone, "27999990000"); eq(d.addr, "Rua A 10"); yes(!("obs" in d), "campo vazio não deve ir");
});
t("pagamento no local nasce liberado (st=ok) e vai para a cozinha (fase=novo)", () => {
  const a = ambiente({ api: [503, {}], db: true }); a.ctx.pfSend(pedido({ pag: "local", st: "ok", fase: "novo" }));
  const d = a.log.sets[0][1]; eq(d.st, "ok"); eq(d.fase, "novo");
});
t("Pix nasce pendente (st=pend) mesmo se o aparelho mandar st=ok", () => {
  const a = ambiente({ api: [503, {}], db: true }); a.ctx.pfSend(pedido({ pag: "pix", st: "ok", sinal: 10 }));
  eq(a.log.sets[0][1].st, "pend");
});
t("rastreio sai com os campos que as regras aceitam", () => {
  const a = ambiente({ api: [503, {}], db: true }); a.ctx.pfSend(pedido());
  const r = a.log.sets[1][1]; eq(r.oid, "UID1"); eq(r.id, 1700000000000); eq(r.fase, "novo"); eq(r.st, "ok"); eq(r.ent, "entrega"); eq(r.nome, "Maria");
});
t("sem internet no banco (resposta 'queued') conta como enviado", () => {
  const a = ambiente({ api: [503, {}], db: "queued" }); a.ctx.pfSend(pedido());
  eq(a.log.backs.length, 0); eq(a.log.fila.length, 0);
});
t("servidor 503 e banco recusa: enfileira para tentar de novo", () => {
  const a = ambiente({ api: [503, {}], db: false }); a.ctx.pfSend(pedido());
  eq(a.log.fila.length, 1); eq(a.sb.TRKQ["ab".repeat(16)], 1); eq(a.log.backs.length, 0);
});
t("servidor 404 e banco recusa: mostra erro ao cliente", () => {
  const a = ambiente({ api: [404, {}], db: false }); a.ctx.pfSend(pedido());
  eq(a.log.backs.length, 1); yes(/Não foi possível enviar/.test(a.log.backs[0]));
});
t("loja fechada (409): NÃO usa o plano B", () => {
  const a = ambiente({ api: [409, { erro: "loja_fechada" }], db: true }); a.ctx.pfSend(pedido());
  eq(a.log.sets.length, 0); eq(a.sb.SRVCLOSED, true);
});
t("estoque insuficiente (409): NÃO usa o plano B", () => {
  const a = ambiente({ api: [409, { erro: "estoque_insuficiente", id: 1, disponivel: 0 }], db: true }); a.ctx.pfSend(pedido());
  eq(a.log.sets.length, 0);
});
t("preço divergente (422): NÃO usa o plano B", () => {
  const a = ambiente({ api: [422, { erro: "preco_divergente" }], db: true }); a.ctx.pfSend(pedido());
  eq(a.log.sets.length, 0); yes(/preços/.test(a.log.backs[0]));
});
t("muitos pedidos (429): NÃO usa o plano B", () => {
  const a = ambiente({ api: [429, { erro: "muitos_pedidos" }], db: true }); a.ctx.pfSend(pedido());
  eq(a.log.sets.length, 0);
});
t("sem conexão com o servidor (status 0): continua na fila, sem plano B", () => {
  const a = ambiente({ api: [0, {}], db: true }); a.ctx.pfSend(pedido());
  eq(a.log.sets.length, 0); eq(a.log.fila.length, 1);
});
t("sem loja carregada (TENANT vazio): plano B não grava nada", () => {
  const a = ambiente({ api: [503, {}], db: true, semTenant: true });
  let r = null; a.ctx.pfDireto(pedido(), (x) => { r = x; }); eq(r, false); eq(a.log.sets.length, 0);
});

console.log("\n[3] Fila do aparelho (pedido que ficou guardado)");
t("fila + servidor ainda com erro 503: grava direto e tira da fila", () => {
  const a = ambiente({ api: [503, {}], db: true, fila: [{ tt: "ab".repeat(16), slug: "loja-teste", pedido: pedido(), ts: 1 }] });
  a.ctx.pfFlush(); eq(a.log.sets.length, 2); eq(a.log.dels, ["ab".repeat(16)]);
});
t("fila + servidor volta a responder 200: tira da fila sem gravar direto", () => {
  const a = ambiente({ api: [200, {}], db: true, fila: [{ tt: "ab".repeat(16), slug: "loja-teste", pedido: pedido(), ts: 1 }] });
  a.ctx.pfFlush(); eq(a.log.sets.length, 0); eq(a.log.dels, ["ab".repeat(16)]);
});
t("fila + ainda sem conexão (0): continua na fila", () => {
  const a = ambiente({ api: [0, {}], db: true, fila: [{ tt: "ab".repeat(16), slug: "loja-teste", pedido: pedido(), ts: 1 }] });
  a.ctx.pfFlush(); eq(a.log.sets.length, 0); eq(a.log.dels.length, 0);
});
t("fila de outra loja com servidor em erro: não grava na loja errada", () => {
  const a = ambiente({ api: [503, {}], db: true, fila: [{ tt: "cd".repeat(16), slug: "outra-loja", pedido: pedido({ tt: "cd".repeat(16) }), ts: 1 }] });
  a.ctx.pfFlush(); eq(a.log.sets.length, 0); eq(a.log.dels.length, 0);
});

console.log("\n[4] App e regras do banco combinam (leitura do texto das regras)");
function lista(txt, inicio) {
  const i = txt.indexOf(inicio); if (i < 0) throw new Error("não achei: " + inicio);
  const a = txt.indexOf("[", i), b = txt.indexOf("]", a);
  return txt.slice(a + 1, b).split(",").map((x) => x.trim().replace(/'/g, "")).filter(Boolean);
}
const fnPedido = rules.slice(rules.indexOf("function pedidoDiretoOk"), rules.indexOf("function rastreioDiretoOk"));
const fnRast = rules.slice(rules.indexOf("function rastreioDiretoOk"));
t("regras: chaves permitidas no pedido cobrem tudo que o app envia", () => {
  const permitidas = lista(fnPedido, "hasOnly");
  const a = ambiente({ api: [503, {}], db: true }); a.ctx.pfSend(pedido({ prontoEm: 1, obs: "sem cebola" }));
  Object.keys(a.log.sets[0][1]).forEach((k) => yes(permitidas.includes(k), "campo fora das regras: " + k));
});
t("regras: campos obrigatórios estão no que o app envia", () => {
  const obrig = lista(fnPedido, "hasAll");
  const a = ambiente({ api: [503, {}], db: true }); a.ctx.pfSend(pedido());
  obrig.forEach((k) => yes(k in a.log.sets[0][1], "falta campo obrigatório: " + k));
});
t("regras: chaves do rastreio cobrem o que o app envia", () => {
  const permitidas = lista(fnRast, "hasOnly"), obrig = lista(fnRast, "hasAll");
  const a = ambiente({ api: [503, {}], db: true }); a.ctx.pfSend(pedido());
  const r = a.log.sets[1][1];
  Object.keys(r).forEach((k) => yes(permitidas.includes(k), "campo fora das regras: " + k));
  obrig.forEach((k) => yes(k in r, "falta campo obrigatório: " + k));
});
t("regras: pedido só é criado pelo dono ou pelo plano B", () => yes(rules.includes("allow create: if isOwner(uid) || pedidoDiretoOk(uid, pid);")));
t("regras: rastreio só é criado pelo plano B (com pedido fb existente)", () => yes(rules.includes("allow create: if rastreioDiretoOk(tk);")));
t("regras: Pix só nasce pendente e local só nasce liberado", () => yes(fnPedido.includes("(d.pag == 'pix' && d.st == 'pend') || (d.pag == 'local' && d.st == 'ok')")));
t("regras: leitura da cozinha continua exigindo st == ok", () => yes(rules.includes("isCozinha(uid) && resource.data.get('st', '') == 'ok'")));
t("regras: ninguém altera o st pela cozinha (update continua igual)", () => yes(rules.includes("hasOnly(['fase', 'iniEm', 'prontoEm', 'liberadoEm'])")));
t("regras: chaves e parênteses balanceados", () => {
  const semTxt = rules.replace(/\/\/.*$/gm, "").replace(/'[^']*'/g, "''");
  eq((semTxt.match(/\{/g) || []).length, (semTxt.match(/\}/g) || []).length, "chaves");
  eq((semTxt.match(/\(/g) || []).length, (semTxt.match(/\)/g) || []).length, "parênteses");
  eq((semTxt.match(/\[/g) || []).length, (semTxt.match(/\]/g) || []).length, "colchetes");
});
t("regras: toda função usada está definida", () => {
  const usadas = new Set((rules.match(/\b([a-zA-Z]+)\(/g) || []).map((x) => x.slice(0, -1)));
  ["pedidoDiretoOk", "rastreioDiretoOk"].forEach((f) => { yes(rules.includes("function " + f), f + " sem definição"); yes(usadas.has(f), f + " sem uso"); });
});

console.log("\nResultado: " + ok + " passaram, " + falha + " falharam, de " + (ok + falha) + " testes.");
if (falha) { console.log("Falharam: " + falhas.join(" | ")); process.exit(1); }
