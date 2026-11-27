"use strict";
// GET /api/saude  (opcional: ?slug=nome-da-loja)
// Diagnóstico para leigos: diz se o servidor consegue gravar pedidos e se a loja manda pedido para a cozinha.
// Usa as MESMAS regras do /api/pedido. Não mostra segredo nenhum.
const fsx = require("./_fs");
const ped = require("./pedido");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  const out = {};
  try {
    const raw0 = process.env.PF_SA_JSON || "";
    out.chave_presente = !!raw0;
    let j = null;
    if (raw0) {
      try {
        let r = raw0;
        if (r.trim()[0] !== "{") r = Buffer.from(r, "base64").toString("utf8");
        j = JSON.parse(r);
      } catch (e) { j = null; }
    }
    out.chave_formato_ok = !!(j && j.client_email && j.private_key);
    out.projeto_da_chave = j && j.project_id ? j.project_id : null;

    let tk = null;
    try { tk = await fsx.token(); } catch (e) { tk = null; }
    out.token_google_ok = !!tk;

    if (tk) {
      try {
        const r = await fetch(fsx.base() + "pf_slugs/teste-saude", { headers: { Authorization: "Bearer " + tk } });
        out.firestore_status = r.status; // 404 = normal (documento de teste não existe); 403/401 = sem permissão; 5xx/429 = Google com problema
      } catch (e) { out.firestore_status = 0; }
    }

    const slug = String((req.query && req.query.slug) || "").toLowerCase();
    if (tk && /^[a-z0-9-]{1,40}$/.test(slug)) {
      try {
        const sl = await fsx.getDocE("pf_slugs/" + encodeURIComponent(slug), tk);
        const uid = sl && fsx.str(sl.uid);
        out.loja_encontrada = !!uid;
        if (uid) {
          const pb = await fsx.getDocE("pf_lojas_publicas/" + encodeURIComponent(uid), tk);
          if (!pb) out.loja_dados_ok = false;
          else {
            try {
              const S = JSON.parse(fsx.str(pb.data) || "");
              out.modo = S.modo || null;
              out.mods_cozinha_ligado = !!(S.mods && S.mods.kds);
              // mesma regra do /api/pedido: só entra na fila da cozinha se o modo é "cardapio" E a cozinha está ligada
              out.cozinha_recebe_pedidos = S.modo === "cardapio" && !!(S.mods && S.mods.kds);
              out.loja_aberta_agora = !!ped.lojaAberta(S, new Date());
            } catch (e) { out.loja_dados_ok = false; }
          }
        }
      } catch (e) { out.erro_leitura_loja = (e && e.fsStatus) || "desconhecido"; }
    }

    let resumo;
    if (!out.chave_presente) resumo = "FALTA a variavel PF_SA_JSON na Vercel (ou falta fazer o Redeploy depois de criar).";
    else if (!out.chave_formato_ok) resumo = "A PF_SA_JSON esta colada errada: precisa ser o conteudo INTEIRO do arquivo .json do Firebase.";
    else if (!out.token_google_ok) resumo = "O Google recusou a chave. Gere uma chave nova no Firebase e troque a PF_SA_JSON.";
    else if (out.firestore_status === 401 || out.firestore_status === 403) resumo = "A chave funciona, mas nao tem permissao no Firestore do projeto (confira o projeto e as permissoes da conta de servico).";
    else if (out.firestore_status !== 404) resumo = "O Firestore respondeu com codigo " + out.firestore_status + " (esperado 404). Confira se o Firestore foi criado no projeto " + (out.projeto_da_chave || "") + " ou tente de novo em instantes.";
    else if (out.erro_leitura_loja) resumo = "Nao deu para ler a loja agora (codigo " + out.erro_leitura_loja + "). Tente de novo; se repetir, veja permissoes do Firestore.";
    else if (out.loja_encontrada === false) resumo = "Servidor OK, mas essa loja NAO existe no banco. Crie a loja logada com Google no endereco oficial.";
    else if (out.loja_dados_ok === false) resumo = "A loja existe, mas os dados publicos dela nao estao legiveis. Abra a loja como lojista e salve de novo.";
    else if (out.loja_aberta_agora === false) resumo = "Servidor OK, mas a loja esta FECHADA agora (horario ou status): o servidor recusa pedidos.";
    else if (out.loja_encontrada === true && out.cozinha_recebe_pedidos === false) resumo = out.modo === "cardapio"
      ? "Servidor OK, mas a COZINHA esta DESLIGADA nos Modulos da loja: o pedido nasce 'pronto' e nao aparece na cozinha."
      : "Servidor OK, mas esta loja nao esta no modo CARDAPIO: o pedido nasce 'pronto' e nao passa pela cozinha.";
    else if (out.loja_encontrada === true) resumo = "Tudo certo: o servidor grava e a cozinha recebe. Obs.: pedido com PIX so aparece na cozinha depois que a loja confirma o pagamento.";
    else resumo = "Servidor OK para gravar pedidos. Informe ?slug=NOME-DA-LOJA para testar a loja.";
    out.resumo = resumo;
  } catch (e) {
    out.resumo = "Erro inesperado no diagnostico.";
  }
  res.status(200).send(JSON.stringify(out, null, 2));
};
