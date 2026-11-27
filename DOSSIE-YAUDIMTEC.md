# DOSSIÊ YAUDIMTEC — leia isto no lugar de ler o projeto

Última atualização: 27/11/2026 · Versão do dossiê: 2.4 · Projeto: `yaudimtec-app-completo` (zip entregue: `yaudimtec-app-completo-corrigido.zip`)

---

## 0. PROTOCOLO PARA A PRÓXIMA IA (obrigatório)

1. **Leia este arquivo primeiro.** Só abra o código para o ponto exato que vai mexer (use a seção 8 e `docs/INDICE-DE-FUNCOES.md`).
2. **Faça só o que o usuário pediu.** Escopo trancado: sem opiniões, sem sugestões extras, sem mudar o que já funciona. Se o pedido for ambíguo, responda o que dá e faça no máximo UMA pergunta.
3. **Quando concluir qualquer pedido, atualize este dossiê** (regra do usuário): acrescente uma linha na seção 12 (Registro), ajuste a seção 11 (Estado e pendências) e, se mudou estrutura, as seções 2 a 8. Depois rode `python3 tools/gerar-indice.py` e `sh tools/conferir.sh`, regenere o zip e entregue o zip + um resumo curto.
   **REGRA FIXA DO USUÁRIO (27/11/2026): todo pedido concluído termina com o dossiê atualizado, SEM EXCEÇÃO (mesmo mudança pequena).** Na entrega, mandar sempre os dois: o zip (com o dossiê atualizado dentro) **e** o `DOSSIE-YAUDIMTEC.md` atualizado como arquivo separado. Antes de entregar, conferir: linha nova na seção 12, seção 11 em dia, versão/data do cabeçalho.
4. **Toda mudança no app entra nas 6 cópias** (ver seção 3). Use `tools/aplicar-em-6-copias.py`.
5. **Não afirme o que não testou.** Diga o que foi testado (e como) e o que não foi (Firebase/Vercel reais nunca foram testados daqui).
6. **Como falar com o usuário:** português do Brasil; é empresário, não técnico; usa o celular (respostas curtas, direto ao ponto); manda mensagens ditadas (podem ter erros de transcrição: interprete a intenção). Pediu "modo turbo econômico" em alguns trabalhos = execução enxuta, sem explorar além do necessário.
7. **Imagens de marketing (Instagram/Facebook/WhatsApp): NÃO gerar agora.** Só no fechamento final, quando o usuário pedir a versão final. Especificação na seção 13.
8. O sandbox da IA não tem internet: não dá para baixar imagens nem rodar Firebase/Vercel reais. Há Chromium (Playwright) para testar a interface.

---

## 1. O que é o sistema (1 minuto)

**Yaudimtec** é uma plataforma de pedidos e agenda para pequenos comércios, vendida pela empresa do usuário (Yaudimtec Soluções Digital). Cada lojista (ADM) tem:
- uma **vitrine/cardápio pública** em `/<endereço-da-loja>` (o cliente pede e envia por WhatsApp/Pix);
- um **painel ADM** (dados, pagamentos, aparência, módulos, equipe, contábil, apps, resumo);
- **apps por função** para a equipe: Loja (balcão/pedidos), Cozinha (KDS), Garçom (mesas), Entregas (motoboy);
- um **painel do Criador** (dono da plataforma) em `/criador`: lista de clientes, assinaturas, marketplace, afiliados, flags, suporte;
- um **site de vendas** (home `/`) para vender a própria plataforma, e `/afiliado` (programa de afiliados).

Modos da loja: **cardápio** (delivery/loja: tem Cozinha, Garçom, Entregador como módulos) e **agenda** (serviços com horário: salão, barbearia, estética, tatuagem).

Tecnologia: **um único `index.html` (~369 KB, ~1.416 linhas, 431 funções) sem framework**, Firebase (Auth + Firestore) no navegador, funções serverless da Vercel em `api/` (Node, sem dependências), PWA (`sw.js` + manifests).

---

## 2. Mapa de arquivos

| Caminho | O que é |
|---|---|
| `index.html` | **O app inteiro** (CSS + HTML + JS). Também é a home de vendas, a vitrine do cliente, o painel do Criador e os perfis. |
| `app/adm|loja|cozinha|garcom|entregas/index.html` | **Cópias** do `index.html`; só o `<head>` muda (manifest, ícone, theme-color, perfil fixo). |
| `api/pedido.js` | Servidor: grava o pedido do cliente (recalcula preço, confere estoque/horário). |
| `api/mesa.js` | Servidor: grava pedido de mesa/balcão do garçom e comissão. |
| `api/baixa.js` | Servidor: baixa/exclusão de pedido e estoque reservado. |
| `api/caixa.js` | Servidor: abrir/movimentar/fechar caixa. |
| `api/loja.js` | Serve a vitrine `/<slug>` com card do WhatsApp (OG) e o **manifest do app do Cliente** `/_manifest/<slug>`. |
| `api/saude.js` | Diagnóstico para leigos: `/api/saude?slug=loja`. |
| `api/_fs.js`, `api/_lib.js`, `api/limite.js` | Acesso REST ao Firestore com conta de serviço; utilitários; limite de pedidos por IP. |
| `firestore.rules` | Regras de segurança do Firestore (publicadas à mão no Firebase Console). |
| `vercel.json` | Rewrites (rotas), funções (maxDuration), headers. |
| `sw.js` | Service worker (cache `pf-v8`, app em rede primeiro). |
| `manifest*.json/.webmanifest` | PWA por perfil (adm, cozinha, garcom, lojista, motoboy, criador, geral). |
| `icons/` | Ícones PNG 192/512 por app (adm, loja, cozinha, garcom, entregas, **cliente**). |
| `img/` | Fotos dos itens por negócio (`img/<negócio>/NN.webp`) — **vazia**; ver seção 10. `LEIA-ME.txt`, `CREDITOS.txt`. |
| `prompts/PROMPTS_IMAGENS_NICHOS.html` | Folha com os 420 pedidos de foto (21 negócios × 20 itens). |
| `afiliado.html` | Página do programa de afiliados. |
| `gestao/*.html` | Páginas curtas de gestão por perfil (adm, cozinha, garcom, lojista, motoboy). |
| `vendor/pdf-lib.min.js` | Biblioteca para gerar PDF (recibo, contábil). |
| `tests/fallback.test.js` | 50 testes automáticos (plano B do pedido + regras). `node tests/fallback.test.js`. |
| `tests/browser/*.js` + `rodar.sh` | Testes de interface no Chromium (ver seção 9). |
| `tools/` | `aplicar-em-6-copias.py`, `conferir.sh`, `gerar-indice.py`. |
| `docs/` | `dossie-yaudimtec.html` (dossiê antigo de 22/11, plano B) e `INDICE-DE-FUNCOES.md` (gerado). |
| `.vercelignore` | Não publica: `tests/ docs/ tools/ prompts/ LEIA-PRIMEIRO.md DOSSIE-YAUDIMTEC.md`. |

---

## 3. Arquitetura (o que precisa saber para não errar)

### 3.1 Seis cópias do mesmo app
`index.html` e `app/{adm,loja,cozinha,garcom,entregas}/index.html` têm **o mesmo corpo**; as 5 cópias diferem do `index.html` em exatamente **13 linhas, só no `<head>`**. Qualquer correção deve ser aplicada com a mesma troca de texto nas 6. `sh tools/conferir.sh` confere sintaxe, as 13 linhas e os 50 testes.

### 3.2 Perfis (quem vê o quê)
- O perfil vem de `?op=` na URL (e `/app/<perfil>/` força o `op`): `adm`, `ped` (Loja), `kds` (Cozinha), `mesas` (Garçom), `ent` (Entregas). Variáveis: `OPQ`, `LOCK`, funções `opv()`, `ownerOp()`, `instKey()`, `pfPapel()`, `pfLock()`.
- Dono logado = `OWNER`, `ACCT={uid,email}`. Criador = `SUPER`. Cliente = vitrine pública (`SLUG`, `TENANT`). Funcionário = `STAFF={oid,uid,papel,st}`.
- Papéis da equipe (campo `papel` do doc `equipe`): `kds`, `mesas` (garçom), `ent` (entregador), `ped` (loja). Fases permitidas por papel: `PF_FASES`.

### 3.3 Dados e armazenamento
- Local: `localStorage` chave `agenda-v6:<uid>` (a loja inteira, objeto `S`) e `agenda-v6:<uid>.bak` (cópia de segurança, no máx. 1/min). Outras chaves: `pf-sess` (sessão do dono), `pf-staff` (sessão da equipe), `pf-theme` (cache do tema), `pf-mesa-out` (fila de pedidos do garçom), `pf-entregas:<oid>:<uid>` (entregas concluídas pelo motoboy).
- Nuvem (Firestore, prefixo `pf_` — o app usa `DB.get/set/merge/del("contas/…")` e o prefixo é adicionado): `pf_slugs/{slug}` (endereço→uid, leitura pública), `pf_lojas_publicas/{uid}` (cópia pública da loja, enviada por `cloudSave()`), `pf_lojas/{uid}` (loja completa, só o dono) com subcoleções `pedidos`, `pedidos/{id}/contato` (telefone/endereço separados), `reservado`, `caixa`, `comissoes`, `equipe`; `pf_rastreio/{token}`, `pf_convites`, `pf_contas/{uid}` (assinatura/plano), `pf_afiliados`, `pf_tickets`, `pf_config`, `pf_limites` (só servidor).
- `S` guarda tudo da loja: `services` (itens/serviços; cada um com `imgs`, `emoji`, `price`…), `orders`, `mods` (`kds`, `garcom`, `entrega`), `theme`, `logo`, `slug`, `nome`, `pix`, etc. `norm()` preenche padrões sem apagar dados. `PUBK` lista os campos que vão para a cópia pública.
- Sem Firebase (aberto local/offline) o app usa só `localStorage`. **O Firebase/Vercel reais nunca foram acessados pela IA.**

### 3.4 Fluxo do pedido do cliente
Vitrine → `data-view` (item) → `data-addcart` → `data-cont` ("Finalizar pedido") → etapa 3 (campos `cn` nome, `cp` telefone, `ce` retirada/entrega, `ca` endereço, `co` obs, botão `data-book`) → handler (`d.book!==undefined`) valida → `recOrder()` monta e grava → `pfSend()` envia a `/api/pedido` → se o servidor der 404/5xx entra o **plano B** (grava direto no Firestore, regras `pedidoDiretoOk`) → tela de confirmação + link WhatsApp (`orderLines()`/`wlink()`).
Pix nasce pendente (só vai à cozinha após "Pix Confirmado"); pagar no local nasce liberado. Cozinha só lê `st=="ok"` e fase `novo/preparo/pronto`.
**Entrega (aviso):** ao escolher Entrega aparecem o aviso padrão (`PF_AVISO_ENT`), o ponto de referência (`cr`, obrigatório se o endereço não tem número ou cita viela/escadaria/sem saída — `pfEndFora`) e o checkbox obrigatório `cac`. O aceite vai em `obs` do pedido com data/hora, com a marca `[CONFIRMAR ACESSO ANTES DE ACEITAR]` quando o endereço foge do padrão (a loja/cozinha mostra o alerta). Se o ADM ligar `S.entBloq` (Módulos), nesses endereços também é obrigatório o checkbox `cdb` ("desço para receber"); desligado (padrão), vale só aviso + confirmação da loja.

### 3.5 Fluxo do garçom
`comandaView()` → `sendMesa()` → `pfMesaRetry()` (3 tentativas, renova token no 401, fila `pf-mesa-out` + `pfMesaFlush()` a cada 20 s) → `pfMesaApi()` → `POST /api/mesa` (único caminho; as regras **proíbem** o garçom de gravar direto, auditoria A-03) → pedido entra com `garcom_uid`.

### 3.6 Segurança da equipe
Link `/equipe/<slug>` ou `?op=…`: o funcionário cria usuário/senha (Firebase Auth), fica `pendente` até o ADM aprovar em ADM → Equipe; só então lê pedidos. `staffInit()` → `withMember()` → `staffLoadStore()` → `staffPoll()` (a cada ~9 s) → `staffEnter()`; `staffExit()` limpa `pf-staff` **e faz `signOut` do Firebase**. Antes da aprovação a tela não carrega nem mostra dados da loja (o `S` é resetado para o padrão).

### 3.7 Módulos e fatura
`MODS()` diz quais módulos estão ativos (Cozinha, Garçom, Entregador; só no modo cardápio). `modCard()` (aba Módulos) mostra o aviso de **R$ 20,00 por módulo/mês** (`PF_MOD_PRECO`) e pede confirmação ao ligar (`data-pfmod`). `subCard()` (assinatura) soma: valor da assinatura `CRI.valor` + `pfModExtra()`; o QR Pix usa o total.

### 3.8 Tema (cores)
`S.theme={c1,c2,grad}` é público. `applyTheme()` → `pfPaint()` aplica CSS vars (`--pri`, `--pri-s`, `--on`, `--grad`) e o `theme-color`. Cache `pf-theme` aplicado no boot (antes da loja carregar). Equipe atualiza o tema em `staffTheme()` (dentro do `staffPoll`). Ao escolher cor, `pfThemeSync()` publica na nuvem (1,2 s depois).

### 3.9 Site de vendas (home) — REDESENHADA em 27/11/2026
`homeView()` agora monta a home **inteira do zero** (CSS + HTML em strings dentro da própria função, classes com prefixo `yh-`, tela cheia via `.yh{width:100vw;left:50%;margin-left:-50vw}` porque o `#app` tem padding). **Aplicativos são o produto principal; criação de site/Google/Instagram é secundário.** Ordem: topo (Entrar / Começar) → hero "Um aplicativo para cada pessoa do seu negócio" com celular mostrando os apps e a notificação de novo pedido → faixa de garantias → **8 aplicativos** (Cliente e Painel da loja em destaque, navy) → faixa "Do pedido à entrega" (4 passos) → escolha do negócio (chips `data-hn`, 21 nichos) + mensalidade fixa → **seção secundária `#site-google`** (criação de site, empresa no Google, Instagram/Facebook + oferta Presença Digital R$ 500, só 10 primeiros, via WhatsApp) → FAQ → afiliados → fechamento → rodapé (+ barra fixa só no celular).
Ganchos mantidos (não renomear): `data-hcreate` (cadastro), `data-hlogin` (entrar), `data-hdemo` (loja de exemplo), `data-hn` (nicho), `/afiliado.html`, `/criador`, WhatsApp por `PF_WPP`. Links do menu rolam com `scrollIntoView` (não usar `#hash`: `hashchange` chama `render()`). **Cuidado com nomes de classe:** `.nav`/`<nav>` já existem no app (barra fixa); por isso o menu da home é `.yh-menu`.
Sem preço de mensalidade na tela ("valor fixo informado no cadastro", como antes). **Código antigo da home removido (27/11/2026):** `PF_CSS`, `PF_H1/H2/H3`, `pfLayout` e a calculadora de taxa (`pfcR`, `pfCalcInit`) não existem mais. Teste: `sh tests/browser/rodar.sh site-home.js` (12 verificações, celular e computador).

### 3.10 Instalação como app (PWA)
Barra de instalar do topo: IIFE no fim do script (`build()/sync()`, `window.pfInstSync`). **Não aparece no app ADM** (`instKey()==="adm"`). Aba Apps do ADM (`appsTab()`): cards Loja, Cozinha, Entregas, Garçom e **Cliente** (o card do ADM foi removido). App do Cliente = a própria vitrine instalável; manifest por loja em `/_manifest/<slug>` (gerado por `api/loja.js`, ícones `icons/cliente-*.png`); o `<link rel="manifest">` é escolhido por script no `<head>`.

---

## 4. API (Vercel) e variáveis de ambiente

| Rota | Função |
|---|---|
| `POST /api/pedido` | Pedido do cliente (sem login). Preço recalculado; 422 preço divergente; 409 loja fechada/estoque; 429 limite por IP. |
| `POST /api/mesa` | Pedido de mesa/balcão e comissão. Exige idToken (dono ou equipe **aprovada**, papel `mesas` ou `garcom`). |
| `POST /api/baixa`, `/api/caixa` | Estoque reservado e caixa (só dono). |
| `GET /api/loja?slug=` | Vitrine HTML + OG. `?manifest=<slug>` = manifest do app do Cliente. |
| `GET /api/saude?slug=` | Diagnóstico do servidor/loja. |

Variáveis: **`PF_SA_JSON`** (conteúdo do .json da conta de serviço — **sem ela `/api/pedido` e `/api/mesa` dão 503**; é a causa nº 1 de "pedido não chega"), `PF_PROJECT_ID`, `PF_API_KEY`, `PF_WEB_API_KEY`, `PF_LIMITE_MAX`, `PF_LIMITE_OFF`. Projeto Firebase: `delivery-67d14`. Chave web do Firebase e e-mail do Criador estão escritos no `index.html` (`PF_FIREBASE`, `PF_CRIADOR_EMAIL`).

---

## 5. Como colocar no ar

1. Subir o zip na Vercel (substituir tudo) e fazer Deploy/Redeploy.
2. Conferir `PF_SA_JSON` em Vercel → Settings → Environment Variables (Redeploy depois de criar/alterar).
3. Regras: copiar `firestore.rules` para Firebase Console → Firestore → Regras → Publicar (necessário só se as regras mudarem; **nesta sessão as regras NÃO foram alteradas**; as da sessão de 22/11 — plano B — precisam estar publicadas: confirmar com o usuário).
4. Testar de verdade: `seudominio/api/saude?slug=nome-da-loja`; fazer um pedido como cliente; mandar um pedido de mesa como garçom.

---

## 6. Receitas — "quero mudar X, olhe aqui"

| Quero mudar… | Onde (funções/variáveis em `index.html`) |
|---|---|
| Abas do ADM / aba inicial | `ADMT`, lista de abas em `render()`, `if(tab==="resumo")…`, `tb_` em `enter()` |
| Resumo financeiro | `resumoView()`, `buildRep()`, `comBlock()`; Contábil: `contabView()` |
| Preço dos módulos / fatura | `PF_MOD_PRECO`, `pfModN`, `pfModExtra`, `modCard`, `subCard`, handler `data-pfmod` |
| Aba Apps | `appsTab()` (lista `P`, `wa(p)`) |
| Checkout / aviso de entrega | etapa 3 (`id="ce"`, `id="avEnt"`, `id="cdb"`), handler `d.book`, `PF_AVISO_ENT`, `pfAvObs`, `pfAvisoBox`, `orderLines` |
| Bloqueio opcional de entrega | `S.entBloq` (em `PUBK`), interruptor em `modCard()` (`data-pfbloq`), validação no handler `d.book` |
| Envio do garçom | `sendMesa`, `pfMesaRetry`, `pfMesaFlush`, `pfMesaApi`; servidor `api/mesa.js` |
| Resumo do motoboy | `entView`, `pfEntResumo`, `pfEntRec`, hook em `setFase` |
| Tema/cores | `applyTheme`, `pfPaint`, `pfThemeSync`, `staffTheme`, `brandAdmin` |
| Persistência | `save`, `enter` (recupera `.bak`/chaves antigas), `cloudSave`, `cloudEnter`, `norm`, `pubCopy`/`PUBK` |
| Login/saída da equipe | `staffInit`, `withMember`, `staffLoadStore`, `staffPoll`, `staffEnter`, `staffExit` |
| Painel do Criador | `superView`, `STAB` (`dash,loj,mkt,pix,afi,flg,sup`), handlers `data-pflok/pflno/pflrm` |
| Site de vendas (home) | `homeView` (seção 3.9) |
| Fotos dos itens | `PFIMG`, `PF_FOTOS`, `pfFoto`, `safeImg`, listener de erro de `<img>`, `NICHOS`, `SEGS` |
| Instalar app | IIFE `pfinst` (fim do script), `instKey`, manifests, `sw.js` |

---

## 7. Dados de negócio embutidos
`SEGS` (grupos) e `NICHOS` (itens prontos): 21 negócios × 20 itens = 420 itens. Alimentação: pizza, lanche, marmita, acai, padaria, rest, pastel. Moda/varejo: roupas, calcados, acess, eletro, perfum. Distribuidoras: agua, pet, farm, bebidas, nat. Serviços (agenda): barb, salao, est, tattoo. Cada item guarda `imgs:[PFIMG(k,i)]` = `/img/<negócio>/NN.webp`.

---

## 8. Convenções de trabalho
- Editar por **troca de texto exata** com `assert` (ver `tools/aplicar-em-6-copias.py`), nunca à mão em uma cópia só.
- Dentro de strings JS do app (como as de `homeView`), aspas simples e quebras exigem escape (`\'`, `\n`).
- Sem emoji em texto que vai para PDF (recibo usa Helvetica/pdf-lib).
- Aceite de entrega grava-se em `obs` do pedido (evita mexer em servidor e regras).
- Tudo em português do Brasil.

---

## 9. Como testar
- `sh tools/conferir.sh` → sintaxe das 6 cópias + 13 linhas de diferença + 50 testes.
- Interface (Chromium sem internet): `sh tests/browser/rodar.sh <arquivo>.js`. Playwright em `/opt/npm-tools/node_modules/playwright` (ou `PLAYWRIGHT_PATH=`). Os scripts semeiam `localStorage` (`pf-sess`, `agenda-v6:u1`) para entrar como ADM sem Firebase. No app ADM a aba de pedidos fica bloqueada de propósito: testar pedidos em `/app/loja/index.html?op=ped`.
- Scripts: `adm-abas-resumo-apps`, `adm-modulos-fatura`, `garcom-motoboy-tema-saida`, `persistencia-e-tema-cache`, `checkout-aviso-entrega`, `checkout-bloqueio-entrega`, `loja-alerta-acesso`, `criador-remover-cliente`, `fotos-unsplash`, `site-home`, `mesa-servidor-simulado` (Firestore falso em memória), `extrair-nichos`.
- Não testado em ambiente real: Firebase, Vercel, regras contra emulador, celular físico.

---

## 10. Imagens dos produtos (estado)
- O app já mostra foto por item; falta o conteúdo. Ordem de resolução: arquivo local `img/<negócio>/NN.webp` → foto de `PF_FOTOS` (Unsplash) → ícone/emoji. Se a imagem falha, volta o ícone (nada quebra).
- **Aplicadas (Unsplash, licença gratuita, créditos em `img/CREDITOS.txt`):** pizza 01 Mussarela, 02 Calabresa, 07 Pepperoni. Os outros 17 da pizzaria e todos os outros negócios continuam com ícone.
- Por que parou: o Unsplash tem pouca variedade de sabores; só se troca quando a descrição da foto bate com o item (a IA não enxerga as fotos, só os textos). Itens de marca (Coca-Cola, Guaraná) não devem usar foto genérica de outra marca.
- Tentativa de 27/11: **suco de laranja (pizza 19)** — o Unsplash devolveu "chá de leite" e "limão na água"; não aplicado. Pizza 14 (chocolate), 15 (banana), 16 (borda recheada) e 20 (combo) ainda não buscados.
- Candidata não aplicada: Margherita — Shopify Burst "a-fresh-margherita-pizza-with-fresh-toppings" (Anugrah Syawaldi; licença "Some Rights Reserved", **não verificada** para esse uso) → `https://burst.shopifycdn.com/photos/a-fresh-margherita-pizza-with-fresh-toppings.jpg`.
- Canva: **sem créditos** ("limite de créditos excedido"). O usuário escolheu o **Unsplash** (Picsart e Adobe foram oferecidos). Fotos geradas por terceiros ficam fora do projeto (IA não baixa arquivos).
- Para gerar por conta própria: `prompts/PROMPTS_IMAGENS_NICHOS.html` (420 pedidos, com nome de arquivo).
- Pedido permanente do usuário: **sempre que possível, melhorar mais imagens que ainda estão em ícone, de acordo com o produto.**

---

## 11. ESTADO ATUAL E PENDÊNCIAS

**Concluído e testado no navegador (local):** as 9 tarefas da seção 12 + aviso de entrega + remover cliente + fotos (3) + ferramentas.

**Decisões em aberto (do usuário):**
- Aviso de entrega: o **bloqueio opcional já existe** (ADM → Módulos → "Entrega em endereço de difícil acesso", campo `S.entBloq`, só aparece com o módulo Entregador ligado). **Padrão = desligado** = aviso + confirmação da loja (pedido vem marcado "Confirmar acesso antes de aceitar"). Ligado: em endereço fora do padrão o cliente precisa marcar que desce para receber, senão o pedido não confirma. Falta o usuário decidir qual padrão vale para lojas novas (hoje desligado).
- Fotos: seguir por bebidas/sobremesas/marmitas (itens com foto característica) e só trocar sabores de pizza quando houver foto que bata.

**Pendências técnicas / riscos conhecidos:**
- **Garçom — causa não confirmada.** O servidor `/api/mesa` funciona em simulação; hoje não há plano B do garçom (regras proíbem gravação direta). Se continuar falhando em produção, checar `PF_SA_JSON`, `/api/saude`, aprovação do funcionário (papel `mesas`). A correção aplicada é de resiliência (retentativa/fila), não de causa.
- Resumo de entregas do motoboy é **só local** (as regras não deixam o entregador ler pedidos "entregue"). Para total na nuvem seria preciso mudar regras/servidor.
- Remover cliente apaga `pf_slugs/<slug>` e `pf_contas/<uid>`; **dados da loja** (`pf_lojas/…`) ficam (só o dono pode apagar pelas regras). Se o cliente entrar de novo, nasce uma conta nova sem plano.
- Cor do `manifest` dos apps de equipe é fixa (só o `theme-color` e as CSS vars seguem o tema).
- Fotos do Unsplash exigem internet do cliente.
- Pontos antigos (22/11) ainda não alterados: e-mail do Criador e chave do Firebase dentro do `index.html`; mensagem de permissão cita "LEIA-ME, passo 4" que não existe; convite da equipe diz "7 dias" num texto e "90 dias" noutro.
- `firestore.rules` e plano B de 22/11: confirmar se foram publicados no Firebase.
- Texto do site (copy): usa técnicas de copywriting pedidas; números/promessas do site ("só 10 vagas", "R$ 500") vêm do texto original — conferir com o usuário antes de mudar.

---

## 12. REGISTRO DE ALTERAÇÕES (atualizar a cada pedido concluído)

**22/11/2026 — Plano B do pedido (sessão anterior; detalhes em `docs/dossie-yaudimtec.html`)**: se `/api/pedido` der 404/5xx o cliente grava direto no Firestore (+rastreio); fila do aparelho; aviso amarelo na loja; regras `pedidoDiretoOk`/`rastreioDiretoOk`; 50 testes; `.vercelignore`.

**26–27/11/2026 — escopo de 9 tarefas (+ extras pedidos)**
1. **Garçom (envio):** `pfMesaRetry` (3 tentativas, token renovado no 401, fila `pf-mesa-out`, `pfMesaFlush`); mensagem clara quando fica na fila; `api/mesa.js` aceita papel `garcom`. Testado: 503,503→200; 401→200; 400 sem retry; 500×3→fila→flush. Causa raiz em produção **não confirmada**.
2. **Apps:** card do ADM removido da lista (`appsTab`); barra de instalar não aparece no app ADM; **app do Cliente** criado (card + manifest `/_manifest/<slug>` + ícones + rewrite no `vercel.json`).
3. **Resumo:** nova aba `resumo` (primeira e padrão do ADM) com o bloco financeiro e comissões; Contábil ficou sem esse bloco.
4. **Módulos R$ 20:** aviso na tela, valor em cada módulo, confirmação ao ativar, fatura soma por módulo (testado: R$ 100 + 3 módulos = R$ 160 no QR Pix).
5. **Persistência:** `.bak` automático, recuperação de chaves antigas, `navigator.storage.persist()`, correção de corrida que podia sobrescrever a nuvem com loja vazia; `sw.js` → `pf-v8`.
6. **Cores globais:** `pfPaint`, cache `pf-theme` no boot, `staffTheme` no poll da equipe, publicação automática (`pfThemeSync`), `theme-color` dinâmico.
7. **Site de vendas:** textos mais curtos; seção **"Aplicativo pela internet"** (agora visível); copy (atenção→interesse→desejo→ação, linguagem conversacional); paleta de ação (laranja `#e8590c/#ff7a1a`, vermelho de urgência, azul-marinho `#10243a`, fundo `#fff8f1`; botão WhatsApp continua verde).
8. **Motoboy:** seção "Resumo de entregas" (total/hoje/mês), contagem local.
9. **Segurança:** `staffExit` faz `signOut`; tela pré-aprovação sem dados da loja ("Acesso da equipe").
- **Aviso de entrega (dossiê v1.1, seção 13):** texto padrão, caixa de aceite obrigatória, ponto de referência (obrigatório em endereço sem número/viela/escadaria/sem saída), aceite com data/hora em `obs`, marca "Confirmar acesso antes de aceitar" na loja/cozinha, repetido na confirmação, WhatsApp, recibo e comanda. Pertence ao produto de delivery (Frente B), não ao pacote de presença digital.
- **Criador — remover cliente:** botão 🗑️ Remover com confirmação dupla (digitar `REMOVER`); apaga `slugs/<slug>` (só se for do cliente) e `contas/<uid>`.
- **Fotos:** `PF_FOTOS`/`pfFoto` + listener de erro; 3 fotos da pizzaria; `prompts/PROMPTS_IMAGENS_NICHOS.html` (420 pedidos).
- **Ferramentas:** `tests/browser/*`, `tools/*`, `docs/INDICE-DE-FUNCOES.md`, `LEIA-PRIMEIRO.md`, este dossiê.
- Arquivos alterados fora do app: `api/loja.js`, `api/mesa.js`, `vercel.json`, `sw.js`, `.vercelignore`, `icons/cliente-*`, `img/CREDITOS.txt`. **`firestore.rules` não mudou.**

**27/11/2026 — Bloqueio opcional de entrega:** interruptor no ADM (Módulos), padrão desligado; ligado, endereço fora do padrão exige "desço para receber" (registrado em `obs`). Testado em 4 cenários (`tests/browser/checkout-bloqueio-entrega.js`). Sem mudança em servidor nem regras. Também: busca de foto para suco de laranja sem resultado adequado (nada aplicado).

**27/11/2026 — Dossiê 2.0 criado** (este arquivo) e protocolo de atualização a cada conclusão.

**27/11/2026 — Limpeza ("remova todo o lixo"):** removido o código morto da home antiga nas 6 cópias (−34 KB por cópia): `PF_CSS`, `PF_H1`, `PF_H2`, `PF_H3`, `pfLayout`, listener e `pfCalcInit` da calculadora (conferido antes que nenhum outro trecho, teste ou API os usava). Nada mais foi apagado. Testado: `conferir.sh` ok (sintaxe, 13 linhas, 50 testes) e os testes de navegador `site-home`, `adm-abas-resumo-apps`, `criador-remover-cliente`, `checkout-aviso-entrega`, `loja-alerta-acesso`, `persistencia-e-tema-cache` rodam sem erro de página (no `checkout-aviso-entrega`, a linha "cartão da loja mostra alerta: false" já dava igual no zip antes da limpeza). Pendente da seção 11 que continua valendo: e-mail do Criador e chave do Firebase dentro do `index.html`, textos de permissão/convite.

**27/11/2026 — Home redesenhada (aplicativos como principal):** nova `homeView()` nas 6 cópias, descrita na seção 3.9; ícones em SVG próprio (os `icons/*.png` do projeto são "PF"/"BEMDI", não da Yaudimtec, e não foram usados); cores do site mantidas (laranja `#e8590c/#ff7a1a`, azul-marinho `#10243a`, fundo `#fff8f1`); fonte Bricolage Grotesque (já carregada no `<head>`). Textos reaproveitados do site anterior (FAQ, afiliados, R$ 500 para os 10 primeiros); sem números novos. Testado no Chromium (celular 390 e computador 1280): sem erro de página, sem rolagem lateral, cliques em Começar/Entrar/loja de exemplo/nicho funcionando, `conferir.sh` ok (13 linhas, 50 testes), `site-home.js` reescrito e passando. **Não testado:** Firebase/Vercel reais, fonte Bricolage online (os testes rodam sem internet), WhatsApp real.

**27/11/2026 — Regra de entrega:** usuário pediu que o dossiê esteja sempre atualizado e seja entregue junto (zip + `.md` separado); registrada no protocolo (seção 0, item 3). Cabeçalho → v2.2.

**27/11/2026 — Banner do link compartilhado (home):** novo `og-yaudimtec.png` (1200×630: logo Yaudimtec, "Seu negócio pronto para vender na internet", chips Criação de sites / Digitalização do negócio / Aplicativos de pedidos, yaudimtec.com.br · Vitória/ES, cores do site). Bloco `<!--OG-->` das 6 cópias trocado (título/descrição/imagem/tamanho/alt, `og:url` = https://yaudimtec.com.br/; o `<title>` de cada app foi mantido); cache do arquivo em `vercel.json`. Testado: `api/loja.js` na raiz devolve as novas tags; `conferir.sh` ok (13 linhas, 50 testes). **Não testado:** colar o link no WhatsApp (só depois de publicar; o WhatsApp guarda cache, pode demorar a atualizar). A logo no banner é um "Y" provisório (o projeto não tinha a logo do Yaudimtec); trocar por `og-yaudimtec.png` com a logo real quando houver. Páginas de loja (`/<loja>`) não mudaram: sem capa, ainda caem em `og-default.png` (que diz "Espaço Pede Fácil").

---

## 13. PACOTE DE MARKETING (Instagram, Facebook, WhatsApp) — ESPECIFICAÇÃO (NÃO GERADO)

**Pedido do usuário:** entre **5 e 7 imagens para cada rede social** (Instagram, Facebook, WhatsApp), com **marketing**, **em português**, **bem enquadradas, sem nenhum elemento sobreposto** — e **garantido por verificação**. **Não gerar agora.** Gerar **somente no fechamento final** (quando o usuário disser que está pronto e pedir a versão final), e então **acrescentar ao dossiê** (esta seção + registro) o que foi gerado.

**Tamanhos já validados no pacote anterior (dossiê v1.1 do usuário):**
- Instagram: feed 1080×1440 (3:4), margem lateral de 60 px sem texto/ícone; stories e capas de reels 1080×1920; destaques 1080×1920; foto de perfil quadrada.
- WhatsApp Business: perfil 640×640; catálogo 1080×1080 (1:1, acima de 500 px); status 1080×1920; imagens para enviar em conversa 1080×1350.
- Facebook: perfil 720×720; capa 1640×624 (laterais fora da área segura; zona da foto de perfil sem texto; no celular a foto cobre a parte inferior esquerda); posts 1080×1350; stories 1080×1920; compartilhar link 1200×630.
- Google Meu Negócio (se pedido): logo 720×720; capa 16:9 1280×720; posts 4:3 1200×900; JPG/PNG entre 10 KB e 5 MB.
- Cada arquivo < 8 MB.

**Critérios de aceite (verificar por script antes de entregar):** dimensões exatas; texto 100% em português correto (sem erros de acento); nenhum bloco de texto/ícone/botão se sobrepõe a outro (conferir interseção das caixas); margens seguras respeitadas; contraste legível; nada cortado nas bordas; prévia visual conferida; contagem 5–7 por rede.

**Método sugerido (não é opinião do usuário; é a forma de garantir os critérios):** compor as artes em HTML/CSS com posições controladas e exportar PNG com Playwright; um script confere interseções e dimensões. Canva está sem créditos.

**Conteúdo de marketing a usar:** produto Yaudimtec (cardápio/vitrine online, pedidos por WhatsApp/Pix, painel ADM, apps Cozinha/Garçom/Entregador/Cliente, aplicativo pela internet, sem taxa por venda). Preços do pacote de presença digital (Frente A) estão no dossiê v1.1 do usuário: piloto R$ 397 (5 primeiros), cheio R$ 597; o site de vendas do app usa a oferta própria (R$ 500, 10 vagas; R$ 1.000 site com aplicativo) — **confirmar com o usuário qual oferta vai nas artes**. Não prometer resultado/ranking (aceite do pacote proíbe).

**Status:** ⬜ não gerado.

---

## 14. Contexto do usuário e do negócio
- Empresa do usuário: **Yaudimtec Soluções Digital** — vende sites e aplicativos e ajuda a aumentar vendas pela internet; trabalho de imagens/Google Meu Negócio/redes sociais com lojista de Vitória como cena.
- Duas frentes (dossiê v1.1 do usuário): **Frente A** = pacote de presença digital (página única, Google, WhatsApp, Instagram, Fan page; R$ 397/597; escopo fechado, sem gestão mensal); **Frente B** = produto de delivery (este app; mensalidade; aviso de entrega é daqui).
- Preferências: escopo trancado; sem opiniões/sugestões extras; respostas curtas; entrega em zip; dossiê atualizado a cada conclusão.

---

## 15. Glossário rápido
**ADM** = dono/lojista · **Criador** = dono da plataforma · **KDS** = tela da cozinha · **slug** = endereço da loja (`/pizzaria-x`) · **plano B** = gravação direta do pedido quando o servidor falha · **módulo** = Cozinha/Garçom/Entregador (R$ 20/mês cada) · **cópias** = as 6 versões do app · **nicho** = tipo de negócio (SEGS/NICHOS).
