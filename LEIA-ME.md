# Yaudimtec na Vercel (link da loja + card do WhatsApp)

## Por que o link do cliente deu "404 NOT_FOUND"

A Vercel só entrega arquivos que existem. O endereço `espaco-pede-facil-v27.vercel.app/nome-da-loja` não é um arquivo, então ela respondia 404. Este pacote resolve isso com o `vercel.json`, que manda esse tipo de endereço para uma pequena função (`api/loja.js`). Ela busca a loja no Firestore, devolve o app com o **nome da loja no card do WhatsApp** e, se algo falhar, entrega o app normal.

Esta versão do app também **liga o login e o banco reais** no endereço `espacopedefacil*.vercel.app`. Nas versões anteriores, na Vercel ele ficava em modo demonstração (sem banco), e por isso a loja não existiria para o cliente mesmo com a rota certa.

---

## Passo a passo

### 1. Subir os arquivos
Coloque na **raiz do projeto** da Vercel (substituindo o que já existe): `index.html`, `vercel.json`, `og-default.png`, `package.json`, a pasta `api/` e a pasta `img/` (pode ficar vazia por enquanto). Faça o deploy (pelo GitHub ou pelo `vercel --prod`).

> **Versão mínima (só destrava o link):** se preferir não usar a função agora, renomeie `vercel.minimo.json` para `vercel.json`. O link da loja passa a carregar, mas o card do WhatsApp fica genérico.

### 2. Firebase: autorizar o endereço
No console do projeto `delivery-67d14`:
1. **Authentication → Configurações → Domínios autorizados → Adicionar:** `espaco-pede-facil-v27.vercel.app` (e o seu domínio próprio, quando tiver).
2. **Authentication → Método de login:** confira que **Google** e **E-mail/senha** estão ativos.

### 3. Chave de API (só se ela tiver restrição por site)
No Google Cloud Console → APIs e serviços → Credenciais → chave de API do app web: **adicione** `https://espaco-pede-facil-v27.vercel.app/*` aos sites permitidos (não remova os que já existem). A função usa a API REST do Firestore, então a restrição de APIs deve incluir **Cloud Firestore API**.

### 4. Regras do Firestore
As regras `pf_` do arquivo `firestore.rules` (do pacote do Firebase) precisam estar **coladas dentro das regras atuais** do projeto. Sem isso o app não salva nada e a função não consegue ler a loja. As coleções `pf_slugs` e `pf_lojas` precisam ter leitura pública.

### 5. Testar
1. Abra `https://espaco-pede-facil-v27.vercel.app/`: deve aparecer a home do Yaudimtec.
2. Crie uma conta de lojista, escolha o nicho e, em **ADM → Endereço da loja**, salve `nome-da-loja`.
3. Abra `https://espaco-pede-facil-v27.vercel.app/nome-da-loja`: a loja deve carregar.
4. Cole o link numa conversa do WhatsApp para ver o card. (O WhatsApp guarda o card em cache; para atualizar use developers.facebook.com/tools/debug.)

Links antigos no formato `?loja=nome-da-loja` continuam funcionando.

### 6. Domínio próprio (opcional)
Na Vercel: Settings → Domains → adicione `espacopedefacil.com.br` e cadastre no Registro.br os registros que a Vercel mostrar. Depois adicione esse domínio também nos **Domínios autorizados** do Firebase.

---

## Fotos dos produtos

Os itens de cada nicho apontam para `img/<nicho>/<NN>.webp` (21 nichos x 20 itens = 420 fotos). Quando a imagem existe, o app mostra a foto; quando não existe, mostra o ícone, sem imagem quebrada. O app **não traz fotos prontas**: elas precisam ser colocadas na pasta `img/`.

### Opção A: fotos reais, automático (recomendado)
Usa o Pexels, que tem licença gratuita para uso comercial.
1. Crie uma chave grátis em pexels.com/api.
2. No terminal, na pasta do projeto: `cd scripts && npm install && cd ..`
3. Rode: `PEXELS_KEY=sua_chave node scripts/baixar-fotos.js`
4. O limite gratuito é de 200 buscas por hora, então o script faz até 180 por vez, **para sozinho e continua de onde parou** quando você rodar de novo (cerca de 3 rodadas para as 420 fotos).
5. Abra `img/revisao.html` para conferir. Troque as que não combinarem substituindo o arquivo pelo mesmo nome. Os créditos ficam em `img/CREDITOS-FOTOS.md`.
6. Faça o deploy.

A busca é automática, então algumas fotos podem não combinar com o item. A revisão serve para isso.

### Opção B: fotos reais, manual
Abra `prompts/FOTOS_REAIS_GUIA.html`: cada item tem a busca pronta no Pexels, Unsplash e Pixabay. Baixe, recorte quadrada, converta para `.webp` (1024x1024, até ~150 KB) e salve com o nome indicado.

### Opção C: foto por link, sem deploy
No painel: Produtos, abra o item, e use **Usar link da foto** com o endereço direto da imagem (começa com `https://`). Serve para ajustes pontuais.

### Opção D: imagens geradas por IA
Em `prompts/PROMPTS_IMAGENS_NICHOS.html` há 420 prompts prontos, com botão de copiar.

**Direitos de imagem:** use só fotos suas, de bancos com licença de uso comercial ou geradas por você. Não copie fotos de outros sites, de lojas ou de buscadores. Evite pessoas reconhecíveis e marcas visíveis.

---

## Operação (/gestao)

As telas de operação ficam em `/gestao`, cada uma instalável como aplicativo:
- **Yaudimtec Cozinha** (`/gestao/cozinha.html`), **Yaudimtec Entregas** (`/gestao/motoboy.html`) e **Yaudimtec Operação** (`/gestao/lojista.html`).
- Cada uma abre o app na aba certa (`?op=kds`, `?op=ent`, `?op=ped`) para quem já tem acesso. Quem não tem acesso cai na home, sem ver a operação.
- **Painel separado em dois modos:** o **ADM** (Dados, Pagamentos, Aparência, Equipe, Módulos) tem o botão "Acessar Modo Loja"; a **Loja** (Pedidos, Produtos, Link) tem o botão "ADM". Os dois nunca aparecem juntos na mesma barra.
- **Link da equipe amigável:** `seusite.com.br/equipe/nome-da-loja` (o token de segurança fica guardado no sistema, não aparece na URL). Exige que o endereço da loja esteja definido. Links antigos `?equipe=token` continuam funcionando. Se as regras do Firestore limitarem os nomes de documentos em `pf_convites`, libere também `s-<endereço>`.
- **Equipe:** o funcionário entra pelo link do dono, fica pendente até ser aprovado e vê só a operação (Cozinha, Garçom e Entregas), nunca o ADM.
- **Regra da farmácia:** lojas do modo vitrine (farmácia, roupas e similares) não têm aba de Cozinha nem de Mesas; o pedido vai direto para as Entregas.

**Sincronização:** o pedido do cliente é gravado na coleção privada da loja (`pf_lojas/<uid>/pedidos`), a mesma que a operação lê. A ponte é esta própria coleção; não há um segundo lugar para os pedidos.

**Limites:** o acesso de cozinha e entregas depende do aparelho ter a aprovação do dono; a `/gestao` depende do app principal (ela abre o app com o parâmetro de aba).

## Antes de subir (checklist curto)

1. **Descompacte e suba a pasta inteira na raiz do projeto da Vercel** (o zip já vem com os arquivos na raiz: `index.html`, `vercel.json`, `api/`, `gestao/`, `img/`).
2. **E-mail de demonstração:** no `index.html`, a constante `PF_CRIADOR_EMAIL` está com `criador@teste.com`. Troque pelo seu e-mail se for usar o modo demonstração. No ar com Firebase, o criador é reconhecido pelo claim `pfCriador`, não por esse e-mail.
3. **Firebase:** autorize `espaco-pede-facil-v27.vercel.app` (e o seu domínio) em Authentication → Domínios autorizados, e ative os logins Google, E-mail/senha e **Anônimo** (para a equipe).
4. **Regras:** copie os blocos `pf_` do `firestore.rules` (do pacote do Firebase) para as regras do projeto.
5. **Teste no ar:** abra `/`, depois `/gestao`, `/gestao/cozinha.html`, e um link de loja `/nome-da-loja`.

**Ainda não testado no ar:** a Vercel real (rotas, função e `/gestao`), o Firebase real e a instalação dos três apps no celular. Esses três itens são o próximo teste.

---


## Home nova (AIDA + hipnose conversacional)

A página inicial (`/`) segue a ordem **Atenção → Interesse → Desejo → Ação**, com linguagem de hipnose conversacional (sugestões no lugar de ordens, perguntas abertas e metáforas do dia a dia). As cores também acompanham a lógica: laranja e dourado no botão de ação (chamam atenção e levam à ação), roxo e cores escuras para o clima de desejo, e verde-água na faixa de benefício. Os nichos continuam como botões, e o cadastro e a loja de exemplo continuam os mesmos.

Para mudar só a home, edite a função `homeView()` no `index.html`. Não mexa nas funções de login e de loja, que usam os mesmos botões (`data-hn`, `data-hcreate`, `data-hlogin`, `data-hdemo`).

---

## Problemas comuns

| Sintoma | O que fazer |
|---|---|
| Continua 404 em `/nome-da-loja` | O `vercel.json` não está na raiz do projeto, ou o deploy não terminou. |
| "Loja não encontrada" | O lojista ainda não salvou o endereço em ADM → Endereço da loja, ou as regras (passo 4) não foram publicadas. |
| Aparece "Modo demonstração" no login | O endereço não é `espacopedefacil*.vercel.app` nem o domínio oficial. |
| Google não abre | Falta o domínio nos **Domínios autorizados** (passo 2). Dentro do WhatsApp ou Instagram o Google pode bloquear: abra no Chrome. |
| O card do WhatsApp não mostra o nome | Veja o código-fonte da página: o título deve ser "Nome da loja | Yaudimtec". Se vier genérico, a função não achou a loja (confira os passos 3 e 4). |

## O que foi testado e o que não foi

Testado aqui: a lógica da função com o Firestore (API REST) simulado, o app em modo Firebase com um SDK simulado e a exibição de fotos com fallback. **Não testado:** o deploy real na Vercel, as regras de reescrita da Vercel, o Firebase real e o card no WhatsApp de verdade.


---

## Painel do Criador (`/criador`) e instalação no celular

- **Acesso:** `seusite.com.br/criador`. Entra só com Google. O e-mail do Criador fica em `PF_CRIADOR_EMAIL` no `index.html` (hoje `edinaldooliveiradesouza@gmail.com`). Qualquer outra conta é desconectada e levada para a home.
- **Abas:** Dashboard (total de ADMs, faturamento estimado, fila de conferência com Aprovar/Recusar, alerta de afiliados), Empresários, Afiliados, Feature Flags e Suporte (Nível 3).
- **Coleções novas no Firestore (prefixo `pf_`):** `pf_afiliados`, `pf_tickets` e o documento `pf_config/flags`. **Libere nas regras:** leitura e escrita só para o Criador em `pf_afiliados` e `pf_tickets`; escrita só do Criador e leitura para logados em `pf_config/flags`.
- **Segurança de verdade:** a tela é só a porta. Quem protege os dados são as regras do Firestore. O ideal é dar ao Criador o *custom claim* `pfCriador` e usar `request.auth.token.pfCriador == true` nas regras. O app também aceita o Google verificado com o e-mail do Criador.
- **Instalar no celular:** botão "📲 Baixar e instalar Yaudimtec <perfil>" numa barra fixa no topo, **em cada um dos 5 perfis** (`/app/adm/`, `/app/loja/`, `/app/cozinha/`, `/app/garcom/`, `/app/entregas/`), **já na tela de entrada (antes do login)**, com o nome do próprio perfil, e **some assim que o app é instalado**. Não existe no Index nem no Criador. Cada perfil tem página fixa, manifest e ícone próprios (v26/v27).


---

## Caixa, Funcionários e Contabilidade

- **Equipe (ADM):** cadastro de funcionários (nome, função, salário base), com Desligar/Reativar. Abaixo fica o convite de acesso da equipe.
- **Caixa (modo Loja):** abertura, suprimento, sangria e fechamento com valor contado. O sistema calcula o esperado (abertura + vendas em dinheiro + suprimentos − sangrias) e mostra a quebra.
- **Pedidos:** nos pedidos pagos no local há os botões 💵 Dinheiro / 💳 Cartão. É assim que o sistema separa dinheiro e cartão no caixa e no relatório (sem marcar, aparece como "forma não informada").
- **Contabilidade (ADM → Contábil):** escolha o mês, informe CNPJ e WhatsApp do contador e use **Baixar PDF** ou **Enviar no WhatsApp**. No celular o PDF vai direto como anexo; no computador ele baixa e abre o WhatsApp para anexar.
- **PDF:** feito com `pdf-lib` (arquivo `vendor/pdf-lib.min.js`, licença MIT), sem depender de CDN, e funciona offline.
- **Privacidade:** funcionários, caixa, CNPJ e WhatsApp do contador ficam só no documento privado da loja (`pf_lojas`). Eles são removidos da cópia pública que os clientes leem.
- Estes módulos aparecem só em lojas de pedidos (cardápio e vitrine), não no agendamento.

## Links na aba Link (modo Loja)

- **Link do cliente:** `seusite.com.br/nome-da-loja`.
- **Link da cozinha:** `seusite.com.br/equipe/nome-da-loja?op=kds`. Abre só a tela da Cozinha.
- **Link do garçom:** `seusite.com.br/equipe/nome-da-loja?op=mesas`. Abre só Mesas e balcão (lojas de cardápio).
- **Link do entregador:** `seusite.com.br/equipe/nome-da-loja?op=ent`. Abre só as Entregas.
- Quem abre pede acesso e só entra depois que o dono aprova em ADM → Equipe. O convite vale 90 dias para novos acessos; quem já foi aprovado continua entrando.
- Cada link só aparece se o módulo estiver ligado (ADM → Módulos). Lojas de agendamento não têm esses links.
- O funcionário fica limitado à tela do link que usou. Isso organiza o trabalho, mas não é uma trava de segurança: ele é equipe aprovada.

## Caixa: entrada e saída com descrição

- Botões **+ Entrada (Suprimento)** e **- Saída (Sangria)** abrem um modal com **Valor** e **Descrição**, os dois obrigatórios. O Confirmar só liga com valor maior que zero e descrição preenchida (mínimo 3 letras). A validação roda de novo ao gravar.
- Cada movimentação grava tipo, valor, descrição, horário e **quem fez** (uid e nome). A abertura e o fechamento também guardam o operador.
- O **Extrato do turno** lista tudo, ex.: "🟢 + R$ 50,00 · Reforço de troco · Por: João".
- Saldo esperado = abertura + vendas em dinheiro + entradas − saídas.

## Garçom: comanda por pessoa e fechamento de conta

- **Comanda por pessoa:** ao abrir uma mesa, cada pessoa tem a sua sanfona (nome editável, itens e subtotal). **+ Adicionar pessoa** cria outra. Ao enviar, a mesa vai **agrupada** para a cozinha, com os itens marcados pelo nome, ex.: "(João) 1x Pizza G". Cada pessoa fica salva no pedido (`pess`).
- **Fechar conta:** três modos.
  - **Total:** uma linha com a conta toda.
  - **Dividir por pessoas:** divide em N partes e ajusta os centavos, então a soma fecha exata (ex.: R$ 100,00 / 3 = 33,34 + 33,33 + 33,33).
  - **Individual:** cada pessoa paga o que consumiu, somando todas as rodadas da mesa.
- Cada linha é paga em **💵 Dinheiro, 💳 Cartão ou Pix**. O botão **Encerrar conta** só liga quando todas as linhas estão pagas. O pagamento grava forma, valor, quem pagou, quem recebeu e o horário (`pg`).
- **Integração:** o dinheiro recebido entra no cálculo do **Caixa**, e o relatório do **contador** separa Pix, cartão e dinheiro. Contas de mesa ainda abertas não entram no faturamento, e aparecem em linha separada.

## Tempo de preparo (SLA da cozinha)

- **Cadastro do produto (lojas de cardápio):** campo "Tempo de preparo (minutos)" no formulário de novo produto e na edição. Em branco vale 20 min.
- **Cozinha:** cada pedido tem um cronômetro `mm:ss / N min`. Ele conta desde a chegada do pedido e usa o **maior** tempo de preparo entre os itens. **Verde** até 75% do tempo, **amarelo** a partir de 75% e **vermelho piscando** (com contorno no cartão) ao estourar.
- **Apito:** ao estourar, toca o bip (4 toques) e vibra. Repete a cada 2 minutos enquanto o pedido seguir atrasado. O navegador só libera o som depois do toque em "Ativar som" na tela.
- Ao marcar **Pronto**, o cronômetro congela com o tempo final (`prontoEm`), vermelho se passou do limite.


---

## Correções da versão 3 (o que mudou e como testar)

**Arquivos novos:** `afiliado.html`, `firestore.rules`, `gestao/garcom.html`, `gestao/manifest-garcom.json`, `tests/gestao.test.js`.
**Alterados:** `index.html`, `sw.js` (cache v2), `vercel.json`, `api/_lib.js`, `gestao/manifest-*.json`, `gestao/*.html`, `package.json`.

1. **Telas isoladas por função.** Quem entra pelo link da cozinha, do garçom ou do entregador só vê a própria tela e só consegue executar as ações dela (a trava vale no clique e em `setFase`): cozinha = Iniciar preparo e Pronto; garçom = abrir mesa, enviar à cozinha, **Servir na Mesa** e fechar conta (não tem "Pronto"); entregas = Saiu e Entregue. A equipe nunca vê ADM, Caixa nem Pedidos do balcão. A cozinha mostra "Aguardando o garçom" nos pratos de mesa. A função da equipe vem só do dono (ADM → Equipe) e as regras do Firestore separam cozinha, garçom e entregas (veja "Separação por função" abaixo).
2. **Manifests PWA separados.** `/manifest-{cozinha,motoboy,garcom,lojista}.json` (na raiz; nomes Yaudimtec Loja, ADM, Cozinha, Entregas e Garçom), com `start_url` e `id` próprios e `scope: "/"` (os antigos apontavam para `/gestao/gestao/...`, que não existe). O `<head>` de cada página `/gestao/*.html` aponta para o seu manifest, e o app principal troca o `<link rel="manifest">` conforme o `?op=` (`ped`/`loja`, `adm`, `kds`, `ent`, `garcom`; sem parâmetro usa o da loja). `?op=adm` abre o modo ADM do dono; `?op=ped` abre o modo Loja (Pedidos) para o botão Instalar usar o certo. Para o garçom: `/gestao/garcom.html`.
3. **Pix no checkout.** Já estava no `index.html` (QR Code + "Copiar Pix copia e cola", valor do sinal ou total). Foi só conferido: o teste valida o valor exato e o CRC16 do código.
4. **Painel do Criador.** Aprovar, Recusar e Dar baixa agora **esperam o Firestore confirmar** antes de mudar a tela. Se as regras negarem, aparece o erro (antes parecia funcionar e não gravava). Um aviso vermelho surge quando a leitura é negada. Ao aprovar a assinatura de uma loja indicada, a comissão é lançada em `pf_afiliados/<id>/vendas` e soma no saldo; **Dar baixa** zera o saldo, marca as vendas como pagas e registra em `baixas`. Em Minha chave Pix há o campo **Comissão do afiliado (%)** (padrão 30%).
5. **Afiliados.** A home tem a seção "Programa de afiliados". O link `?ref=codigo` é guardado por 60 dias e gravado na conta quando o empresário se cadastra. `afiliado.html` (também em `/afiliado`) tem login (Google ou e-mail e senha com confirmação), cadastro, link exclusivo, carteira (a receber, recebido, indicados) e histórico. O Criador pode cadastrar o afiliado com e-mail; o afiliado também pode se cadastrar sozinho.
6. **firestore.rules.** Cobre `pf_slugs`, `pf_lojas_publicas`, `pf_lojas` (pedidos, equipe), `pf_convites`, `pf_contas`, `pf_afiliados`, `pf_tickets` e `pf_config`. Resumo: cozinha/garçom/entregas só com aprovação do dono; o dono não aprova a própria assinatura; o afiliado só lê o que é dele e só edita nome, WhatsApp e Pix; o cliente só cria pedidos (sem campos de operação).

**Antes de testar:** publique o `firestore.rules`, confira `edinaldooliveiradesouza@gmail.com` nele, e ative **Google** e **E-mail/senha** no Firebase Auth (o portal usa os dois). Atenção (v7): o cliente não grava mais pedido no Firestore; o pedido entra só por `/api/pedido` (veja "Atualização v7").

**Não testado no ar:** Firebase real, regras no emulador, Vercel e instalação no celular. Foi testado em Node: sintaxe dos scripts, manifests, travas por função, Pix (CRC16) e estrutura das regras (`npm test`).

## Atualização v5

1. **Afiliado 50%.** A comissão padrão é 50% (plano base R$ 49,90 → R$ 24,95). Se no painel do Criador o campo "Comissão do afiliado" estiver salvo com outro número (ex.: 30), ele continua valendo: abra o painel e confirme que está 50.
2. **PDFs.** O relatório de Contabilidade (ADM) agora também traz a seção "Comissões dos garçons". Na aba Pedidos, cada pedido tem o botão **🧾 Recibo**, que baixa o PDF do cliente. Os dois usam o `vendor/pdf-lib.min.js` que já está no projeto (funciona sem internet e sem depender de CDN).
3. **Impressora Bluetooth.** Em *Dados da empresa* há o cartão **Impressora Bluetooth** (Conectar, Imprimir teste, Desconectar), e cada pedido tem o botão **🖨️ Imprimir**. Exige Chrome no Android e site em HTTPS; impressora térmica ESC/POS com Bluetooth LE. É preciso conectar uma vez a cada vez que o app é aberto (regra do navegador).
4. **Comissão do garçom.** Em *Dados da empresa* defina a % (padrão 10; 0 desliga). Ao encerrar a conta, o sistema calcula sobre o total dos pedidos de cada garçom e grava em `pf_lojas/{uid}/comissoes`. O total do mês aparece em Contabilidade. **Publique o firestore.rules novo.**

## Atualização v6 (4 requisitos esquecidos)

1. **Rastreio sem login.** Todo pedido nasce com um `tracking_token` (32 caracteres, gerado no aparelho do cliente). O status público fica em `pf_rastreio/<token>` (sem telefone nem endereço). Na tela "Pedido pronto" o cliente toca em **Acompanhar meu pedido** e vê a etapa em tempo real (`onSnapshot`); o link `/<loja>?rastreio=<token>` também funciona. Quando a loja muda a fase ou confirma o Pix, o espelho é atualizado sozinho.
2. **Loja aberta/fechada pelo horário (v8).** O botão manual "Loja aberta / Fechada" saiu da aba Pedidos. No painel, em **Dados > Disponibilidade**, o dono marca os **dias de atendimento**, o **início e o fim** (até 00:00) e, se quiser, o **intervalo** (ex.: almoço). Dentro do horário a loja aceita pedidos; fora dele (ou no intervalo) o botão "Finalizar pedido" some e aparece "Loja fechada", com os dias e horários de atendimento. Enquanto o dono não mexer nesses campos, a loja continua sempre aberta (lojas antigas não fecham sozinhas). A trava também existe no servidor (`/api/pedido` devolve 409), pelo horário de Brasília (UTC-3). Pedido com Pix já pago não é perdido. O cartão Disponibilidade já existia nos nichos de agendamento e agora vale para todos.
3. **API de pedidos.** `api/pedido.js` (POST) valida, confere loja aberta e grava o pedido e o rastreio. (v7) Se a API falhar ou o aparelho estiver sem internet, o pedido fica numa fila local (IndexedDB) e é enviado quando a API voltar; não há mais gravação direta no Firestore.
4. **Aba Marketplace (Criador).** Mostra lojas cadastradas, lojas ativas, motoboys ativos e motoboys por loja.

**Faça no deploy:** publique o `firestore.rules` novo (coleção `pf_rastreio` e leitura da subcoleção `equipe` pelo Criador) e faça o deploy da pasta `api/` com o `vercel.json` novo.
**Limites:** não testado no ar: Firebase real, regras no emulador e Vercel.

## Atualização v7 (segurança: preço no servidor e sem gravação direta)

1. **Preço recalculado no servidor.** `api/pedido.js` lê os preços reais da loja (`pf_lojas_publicas`), refaz a conta (preço × quantidade + adicionais) e confere o total enviado. Total **menor** que o real: rejeita (422 `preco_divergente`). Total maior: aceita, mas grava o valor do servidor. O texto dos itens, o total, o sinal e a forma de pagamento gravados são sempre os do servidor. Item ou adicional que não existe na loja: rejeita (422).
2. **Sem fallback inseguro.** O app não grava mais pedido nem rastreio direto no Firestore. Sem internet ou com a API fora do ar (rede, 5xx, 429), o pedido vai para uma **fila local em IndexedDB** (`pf-fila`; se o navegador não tiver IndexedDB, usa o localStorage) e é reenviado sozinho (a cada 15 s e quando a internet volta). Rejeição definitiva (loja fechada, preço mudou) não entra na fila: o cliente volta ao passo "Seus dados" com o aviso.
3. **Regras fechadas.** `firestore.rules`: o cliente não cria mais `pf_lojas/<uid>/pedidos` (só dono e garçom) nem `pf_rastreio` (só o servidor). A função `customerOrder()` foi removida.
4. **Credencial do servidor (obrigatória).** Como o servidor passa a gravar com permissão própria, crie uma chave de conta de serviço: Firebase > Configurações do projeto > Contas de serviço > **Gerar nova chave privada** (a conta precisa do papel *Cloud Datastore User*). Na Vercel (Settings > Environment Variables) crie `PF_SA_JSON` com o conteúdo do JSON (ou ele em base64) e faça novo deploy. **Sem essa variável a API responde 503 e nenhum pedido novo é gravado** (os pedidos ficam na fila do aparelho do cliente). Nunca coloque essa chave no `index.html`.
5. **Ordem do deploy:** primeiro `PF_SA_JSON` + deploy da pasta `api/`, depois publicar o `firestore.rules`. Se publicar as regras antes, os clientes ficam sem poder enviar.

**Limites:** não testado no ar (Firebase, Vercel, navegador real). O estoque não é conferido no servidor. Se o cliente já pagou o Pix (`st=pend`) e o preço mudou antes do envio, o pedido é recusado e ele é orientado a falar com a loja. A fila só existe no aparelho do cliente: se ele limpar os dados do navegador antes de a internet voltar, o pedido se perde.



## Separação por função (cada aplicativo só mostra o que é do seu grupo)

- **Equipe (Cozinha, Garçom, Entregas):** a função vem **somente** do que o dono escolheu em ADM → Equipe. Mudar `?op=` na URL não troca de função. Se o aplicativo aberto for de outra função (ou for o ADM/Loja), aparece "🔒 Aplicativo de outra função" com o botão para abrir o app certo, e nenhum dado é carregado. Quem foi aprovado sem função fica em "Aguardando a sua função". Se o dono mudar a função, a tela do funcionário atualiza sozinha.
- **Dono nos aplicativos instalados:** `?op=adm` mostra só o ADM (sem o botão para o modo Loja); `?op=ped` mostra só a Loja (Pedidos, Produtos, Caixa, Link, sem o botão ADM e sem as telas de Cozinha, Mesas e Entregas); `?op=kds`, `?op=ent` e `?op=garcom` mostram só aquela tela e só as ações dela. Sem `?op=` (site normal) o dono vê tudo. O `?op=` agora **permanece na URL**, então recarregar o app não destrava nem troca o manifest.
- **Firestore:** além da leitura e escrita de pedidos por função (já existia), o rastreio do cliente (`pf_rastreio`) agora só aceita da equipe a transição da própria função e nunca o campo de pagamento `st`. **Publique o `firestore.rules` de novo.**
- **Limite:** o ADM e a Loja são a mesma conta do dono. A trava por `?op=` separa os aplicativos, mas quem tem o login do dono pode abrir o site normal e ver tudo. Para dar o balcão a outra pessoa sem dar o ADM, o certo é uma função própria de funcionário para o balcão (ainda não existe).


## Atualização v23 (botão de instalar por perfil e Loja que opera)

1. **Botão de instalar por perfil.** O ADM → Dados mostra só o botão do ADM; cada perfil tem o seu botão no próprio aplicativo.
2. **Loja da equipe (gerente/balcão) opera.** Antes ela só lia os pedidos. Agora, com a função Loja aprovada pelo dono:
   - tem as abas **Pedidos** e **Caixa**;
   - **confirma o Pix** (só de pendente para ok), marca Dinheiro/Cartão e avança o status do pedido (Em preparo, Pronto, Saiu, Entregue/Retirado);
   - **abre e fecha o caixa** e lança entradas e saídas, sempre com a descrição e o nome de quem fez;
   - não altera preço, itens nem dados do cliente, não exclui pedido e não acessa o ADM.
3. **Caixa compartilhado.** O caixa agora fica no documento `pf_lojas/<uid>/caixa/estado` (dono e Loja leem e gravam), para o dono e o gerente verem o mesmo caixa. O caixa antigo, que estava no documento da loja, é copiado para lá na primeira vez que o dono abre o app. Se dois aparelhos gravarem ao mesmo tempo, vale o último.
4. **firestore.rules:** `isLoja()` agora pode atualizar pedidos (campos de operação), o rastreio (fase e Pix) e o caixa. **Publique o `firestore.rules` de novo.**

**Testado:** leitura das regras e do app nos testes (`npm test`). **Não testado:** emulador do Firestore, Firebase real e celular real.

## Atualização v24 (revisão técnica: Loja, perfis, servidor e letras)

**Publique de novo as regras do Firestore** (`firestore.rules`): a criação de pedido pelo Garçom passou a aceitar `fase` "novo" ou "pronto" (necessário quando a Cozinha está desligada). Sem republicar, o garçom de uma loja sem Cozinha não consegue enviar pedido da mesa.

- **Estoque reservado no servidor** (v24, janela de 7 dias): **substituído no v25 pelo contador transacional; veja "Atualização v25" no fim deste arquivo.**
- **Servidor (`api/pedido.js`)**: confere o estoque publicado (soma das linhas do mesmo produto; 409 `estoque_insuficiente`) e recusa entrega com o módulo desligado (422 `entrega_indisponivel`). Pedido com Pix já pago (`pend`) nunca é recusado: o estoque é ignorado e a entrega vira retirada. Sem Cozinha ligada, o pedido nasce `pronto` (vitrine vai direto para Entregas; mesa vai direto para "Prontos para servir").
- **Loja (aba Pedidos)**: pedido de mesa/balcão sem telefone/WhatsApp vazio e com o tipo certo; o % do sinal vem do próprio pedido; excluir pedido pede confirmação; sem botão "Pedidos" solitário.
- **Cozinha/Garçom/Entregas/Cliente**: fila da Cozinha do mais antigo para o mais novo; sem botão morto "Retirado" na Cozinha; encerrar a conta marca o pedido "pronto" como entregue; rota do entregador limitada a 10 paradas (aviso no botão); rastreio de retirada termina em "Retirado".
- **Letras maiores**: nada abaixo de 14 px; texto base 18 px; barra de abas rola para o lado.
- **Instalar**: o botão "Baixar e instalar" volta sozinho se o app foi desinstalado (o Chrome voltou a oferecer a instalação).
- **Título da aba**: a página inicial não mostra mais o nome da loja de exemplo (só em página de loja/painel, no formato "Nome | Yaudimtec").
- **Service worker**: não guarda mais página de erro (404/500) no cache.

### Esteira de testes (CI)
- `.github/workflows/ci.yml` roda `npm test` a cada push e pull request. Na Vercel/GitHub, ative "Require status checks" na branch `main` para só publicar com testes verdes.
- `tests/qualidade.test.js` trava: JSON válido, sintaxe de todos os scripts, regras do Firestore balanceadas, nenhuma letra abaixo de 14 px e marca Yaudimtec (o nome antigo da marca não pode voltar).
- Ambientes separados já são suportados por variável: `PF_PROJECT_ID`, `PF_API_KEY` e `PF_SA_JSON` (use um projeto Firebase de teste e outro de produção).

## Atualização v25 (estoque reservado por contador, sem janela de 7 dias)

**Faça nesta ordem:** 1) publique o `firestore.rules`; 2) suba o projeto na Vercel (agora há `api/baixa.js`); 3) abra o painel do lojista uma vez em cada loja.

**Como funciona**
- Cada produto com estoque controlado tem um contador em `pf_lojas/<uid>/reservado/<produtoId>` (campo `q`). Só o servidor grava nele; o dono pode ler.
- **Pedido novo (`/api/pedido`)**: numa transação REST (`beginTransaction` → leituras → `commit`), o servidor lê o estoque publicado e o contador, confere `estoque - reservado` e, no MESMO commit, cria o pedido e soma o contador (`increment`). Dois pedidos ao mesmo tempo não passam juntos: um deles recebe 409 `estoque_insuficiente`. Custo: 1 leitura por produto (antes: até 600 por pedido). Pedido com Pix já pago (`pend`) continua nunca sendo recusado: só reserva.
- **Baixa (`/api/baixa`, `acao:"baixa"`)**: o app do lojista abate o estoque publicado (como antes) e SÓ DEPOIS de salvar na nuvem pede ao servidor a baixa. O servidor marca `baixa:true` e devolve o reservado, também em transação. Chamar duas vezes não desconta duas vezes. O app não escreve mais `baixa` direto no Firestore; ele marca `sb:true` no pedido ("estoque publicado já abatido") para não abater duas vezes se a chamada falhar e repetir.
- **Excluir pedido**: passa por `/api/baixa` (`acao:"excluir"`). Se o pedido ainda não tinha baixa, o reservado volta. Se o servidor não responder, o app apaga direto (a venda não trava) e o contador pode ficar com reserva a mais; use a reconciliação abaixo.
- **Quem pode chamar `/api/baixa`**: só o dono da loja, com o login do Firebase (idToken). Funcionário (login anônimo) e cliente recebem 401 ou não enxergam pedido nenhum.
- **Falha aberta**: se a transação não funcionar (Firestore fora do ar, por exemplo), o pedido é gravado com `rv:false` (sem reserva), vale o estoque publicado e a venda não trava. Pedido `rv:false` nunca mexe no contador.
- **Migração sem script**: o contador de um produto que ainda não existe é criado na primeira venda a partir dos pedidos sem baixa dos últimos 7 dias (os do v24 entram na conta). Depois disso a janela não é mais consultada.

**Conserto de divergência** (reservado travado a mais): com o login do dono, `POST /api/baixa` com `{"acao":"reconciliar"}` refaz os contadores a partir dos pedidos sem baixa. Não é atômico contra pedido entrando no mesmo instante: rode com a loja calma.

**Testado** (`npm test`, Firestore e login simulados): contador criado e somado no mesmo commit; 409 sem alterar nada; semente do legado; conflito de transação (aborta, relê e decide); reenvio do mesmo pedido sem reservar duas vezes; falha aberta; baixa e exclusão idempotentes; 401 sem login e para equipe; reconciliação. **Não testado:** Firestore real, Vercel, concorrência de verdade e celular. Antes de vender: com 1 unidade em estoque, faça dois pedidos ao mesmo tempo em dois navegadores; um deve receber o 409. Depois abra o painel do lojista, deixe dar baixa e confira em `reservado/<produto>` no console do Firebase que o contador voltou a 0.

**Teste de corrida** (`scripts/corrida.js`, Node 18+): `node scripts/corrida.js <url> <slug> <produtoId> <preco> 5` dispara 5 pedidos ao mesmo tempo para um produto com estoque 1 e confere que só 1 é aceito (os outros 4 vêm 409). Depois o contador `reservado/<produtoId>` deve estar com `q = 1`. Os pré-requisitos estão no cabeçalho do script. Apague os pedidos de teste pelo painel entre as rodadas.

**Limites conhecidos**
- O estoque REAL (`estoque_atual`) continua dentro do JSON da loja e sendo abatido pelo app do lojista. Um tablet com cópia velha ainda pode sobrescrever o estoque ao salvar. O v25 não resolve isso; resolver pede um endpoint de ajuste de estoque que some em vez de sobrescrever (próximo passo).
- Se o app do lojista ficar fechado, o contador segura o estoque (o produto aparece como acabado no 409 mesmo havendo unidade física); é o comportamento seguro, e a baixa corrige ao abrir.
- `firestore.rules`: o dono ainda pode apagar pedido direto pelas regras (um app antigo em cache faria isso e deixaria reserva a mais; use a reconciliação).
