# GUIA COMPLETO — do zero ao ar (para leigo)

Tempo: cerca de 40 minutos. Faça num COMPUTADOR, na ordem. Só passe ao próximo passo quando terminar o anterior.

O sistema novo vai para **app.espacopedefacil.com.br**.
O app antigo (espacopedefacil.com.br) continua funcionando e NÃO é alterado.

---
## BLOCO 1 — Supabase (banco de dados)

1. Abra **supabase.com** → **Start your project** → entre com o GitHub (ou crie conta).
2. **New project**. Preencha:
   - Name: `bemdi`
   - Database Password: crie uma senha forte e ANOTE.
   - Region: **South America (São Paulo)**
3. Clique **Create new project** e espere ~2 minutos.
4. Menu da esquerda → **SQL Editor** → **New query**.
5. Abra o arquivo **`1-COLAR-NO-SUPABASE.sql`** (está na pasta do projeto) com o Bloco de Notas.
6. Ctrl+A (selecionar tudo) → Ctrl+C (copiar) → clique na área branca do Supabase → Ctrl+V (colar).
7. Clique **Run**. Aparece **Success. No rows returned**. (Se der erro, tire foto e me mande. NÃO rode duas vezes.)
8. Engrenagem **Project Settings** → **API**. Copie e anote:
   - **Project URL**  → ______________________
   - **anon public** (ou "Publishable key") → ______________________

---
## BLOCO 2 — GitHub (guardar o código)

1. **github.com** → crie a conta (ou entre).
2. Botão **+** (canto superior direito) → **New repository**.
3. Repository name: `bemdi-saas` → marque **Private** → **Create repository**.
4. Clique no link azul **uploading an existing file**.
5. Descompacte o zip (botão direito → Extrair tudo).
6. ENTRE na pasta descompactada, selecione TUDO que está dentro (Ctrl+A) e arraste para a página do GitHub.
   (Arraste o CONTEÚDO, não a pasta.) Espere terminar de enviar.
7. Role a página → **Commit changes**.
8. Confira: na página do repositório devem aparecer `package.json`, `src`, `public`.

---
## BLOCO 3 — Vercel (colocar no ar)

1. **vercel.com** → **Sign Up** → **Continue with GitHub**.
2. **Add New… → Project**.
3. Ao lado de `bemdi-saas` clique **Import**.
4. NÃO mexa em Framework (deve estar "Next.js").
5. Abra **Environment Variables** e adicione as duas (Key, Value, **Add**):
   - `NEXT_PUBLIC_SUPABASE_URL` → o Project URL do Bloco 1
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → a chave anon do Bloco 1
6. Clique **Deploy**. Espere 1–2 minutos até a tela de parabéns.
   (Se falhar: abra o deploy → "Build Logs" e me mande as últimas linhas.)

### Colocar no seu domínio .com.br (subdomínio app)
7. No projeto, vá em **Settings → Domains**.
8. Digite `app.espacopedefacil.com.br` → **Add**.
9. A Vercel mostra um registro **CNAME** (nome `app`, valor parecido com `cname.vercel-dns.com`). Copie.
10. Entre no **Registro.br** → seu domínio → **Editar zona** (DNS) → **Nova entrada**:
    - Tipo: **CNAME**
    - Nome: `app`
    - Dados/Valor: o que a Vercel mostrou
    Salve.
11. Volte à Vercel e aguarde ficar **Valid Configuration** (de minutos até algumas horas).

---
## BLOCO 4 — Ligar Supabase ao seu domínio

1. Supabase → **Authentication** → **URL Configuration**.
2. **Site URL**: `https://app.espacopedefacil.com.br` → **Save**.
3. **Redirect URLs** → **Add URL** (uma de cada vez):
   - `https://app.espacopedefacil.com.br/app/**`
   - `https://app.espacopedefacil.com.br/convite/**`
4. Supabase → **Authentication → Providers → Email**: deixe **Confirm email** LIGADO.

---
## BLOCO 5 — Primeiro teste

1. Abra `https://app.espacopedefacil.com.br/app/adm/`
2. Toque **Primeira vez? Criar conta** → nome, e-mail, senha (8+ caracteres) → **Criar conta**.
3. Abra o e-mail de confirmação e clique no link.
4. Volte e faça **Entrar**. Aparece **Criar minha empresa**: digite o nome → **Criar**.
   Você é o **Owner** (dono). Pronto.
5. No celular (Chrome Android), abra o mesmo endereço e toque **📲 Baixar e instalar**.

---
## BLOCO 6 — Login com Google (opcional, pode ser depois)

1. **console.cloud.google.com** → crie um projeto.
2. **APIs e serviços → Tela de permissão OAuth** → tipo **Externo** → preencha nome e e-mail → salve.
3. **Credenciais → Criar credenciais → ID do cliente OAuth** → tipo **Aplicativo da Web**.
4. Em **URIs de redirecionamento autorizados**, cole o endereço que o Supabase mostra em
   **Authentication → Providers → Google** (termina em `/auth/v1/callback`).
5. Copie **Client ID** e **Client Secret** → cole no Supabase (mesma tela) → ative **Google** → **Save**.

---
## Convidar e aprovar equipe (dentro do app, sem mexer no Supabase)
1. Entre em `https://app.espacopedefacil.com.br/app/adm/` → toque **👥 Equipe**.
2. Digite o e-mail da pessoa, escolha **Gerente / Garçom / Motoboy / Cozinha** → **Criar convite**.
   (Gerente só o Dono convida. O Gerente convida apenas funcionários.)
3. Toque **Enviar por WhatsApp** (ou **Copiar**) e mande o link.
4. A pessoa abre o link, cria a conta COM O MESMO E-MAIL e toca **Aceitar convite**. Fica "pendente".
5. Na mesma tela **Equipe**, o cartão amarelo aparece: toque **Aprovar** (ou **Rejeitar**).

Aplicativos por função: Dono/Gerente → ADM e Loja · Garçom → `/app/garcom/` · Motoboy → `/app/motoboy/` · Cozinha → `/app/cozinha/`.

## Se você JÁ tinha rodado o SQL antigo
Rode também (SQL Editor → New query → colar → Run) o arquivo `2-ATUALIZACAO-SE-JA-RODOU-O-SQL-ANTIGO.sql`.
Instalação nova: NÃO precisa; o arquivo 1 já vem corrigido.

## Problemas comuns
- **"package.json não encontrado"**: você subiu a pasta, não o conteúdo. Refaça o Bloco 2.
- **Volta para o login depois de entrar**: confira as variáveis (Bloco 3, passo 5) e as Redirect URLs (Bloco 4). Depois de mudar variáveis: Vercel → Deployments → ⋯ → **Redeploy**.
- **Domínio "Invalid Configuration"**: o CNAME do Registro.br está errado ou ainda propagando.
- **Google: redirect_uri_mismatch**: o endereço do Bloco 6 passo 4 difere do mostrado no Supabase.
