# Bemdi SaaS — Multi-app, Multi-tenant (Next.js 15 + Supabase)

## Rodar
1. `cp .env.example .env.local` e preencha URL + anon key.
2. Rode `supabase/migrations/20261121000000_multitenant_rbac.sql` no SQL Editor (ou `supabase db push`).
3. Supabase → Authentication:
   - **Providers → Google**: ative e informe Client ID/Secret (Google Cloud → credencial OAuth, redirect = `https://<projeto>.supabase.co/auth/v1/callback`).
   - **URL Configuration → Redirect URLs**: `https://SEU-DOMINIO/app/**` e `https://SEU-DOMINIO/convite/**` (+ `http://localhost:3000/**` em dev).
   - **Email → Confirm email**: deixe LIGADO (o convite só é aceito com e-mail confirmado).
4. `npm i && npm run dev` (PWA exige HTTPS em produção; `localhost` funciona).

## Mapa das regras
| Regra | Arquivo |
|---|---|
| 1. Instalar PWA (função única) | `src/lib/pwa/useInstallPWA.js`, `earlyCapture.js`, `components/pwa/InstallButton.jsx`, `public/manifests/*` |
| 2. Logout / login / Google | `src/lib/auth/useLogout.js`, `components/auth/LoginForm.jsx`, `AuthGuard.jsx`, `app/app/[app]/auth/callback/route.js` |
| 3. Multi-tenant + RLS | `supabase/migrations/…sql` |
| 4. RBAC + convites | mesmo SQL (RPCs) + `app/convite/[token]`, `pendente`, `onboarding` |
| Proteção de rotas | `src/middleware.js` |

## Status
Fundação pronta: login, multiempresa/RLS, convites, aprovação (tela Equipe), PWA por app. **Ainda não há** os módulos operacionais (produtos, pedidos, caixa, mesas, entregas) nem APK; o `build` do Next ainda não foi executado.

## Fluxo de convite
1. Owner cria empresa em `/app/adm/onboarding/` (RPC `create_company`).
2. Owner insere em `invitations` (`email` em minúsculas, `role` = `manager` | `staff`, `staff_function` = `waiter` | `courier`) e envia `https://SEU-DOMINIO/convite/<token>`.
3. Convidado abre o link, cria conta/Google **com o mesmo e-mail** e aceita → `store_members.status = 'pending'`.
4. Owner aprova: `supabase.rpc('approve_member', { p_member_id, p_approve: true })` (Manager só aprova `staff`).

## Decisões importantes
- **Login dentro do escopo do PWA** (`/app/<app>/login/`), não em `/login`: se o login ficasse fora do `scope` do manifest, o Chrome mostraria a barra do navegador e o app "sairia" do modo standalone. Mesmo motivo do `trailingSlash: true`.
- **Logout usa `router.replace`** (não `push`): o histórico é trocado, então "Voltar" não retorna à tela autenticada. Além disso: middleware com `Cache-Control: no-store`, `AuthGuard` (SIGNED_OUT / bfcache) e trava de "Voltar" na tela de login.
- **Página principal sem manifest** (propositalmente). O botão dela chama a mesma `instalarApp()`; sem evento, a função leva ao app escolhido (`/app/<app>/login/?install=1`), onde o Chrome libera o prompt.
- **O middleware NÃO é a barreira de segurança, o RLS é.** Middleware só melhora UX/roteamento.
- Otimização futura: mover `role`/`company_id` para claims do JWT (Custom Access Token Hook) para o middleware não consultar `store_members` a cada requisição.

## Checklist de teste
- [ ] Chrome Android em `/app/adm/` → botão abre o prompt nativo; depois de instalar, o botão some.
- [ ] Na página `/`, tocar em "Baixar e instalar" → vai para o app → tocar de novo → prompt nativo.
- [ ] Sair → cai em `/app/adm/login/`; botão Voltar não abre tela protegida.
- [ ] Usuário da empresa A não lê `orders` da B (teste no SQL Editor com `set local role authenticated` + `request.jwt.claims`).
- [ ] Garçom só vê pedidos com `assigned_to` = ele e não abre `/app/adm/`.
- [ ] Convite com e-mail diferente do Google logado → "outro e-mail".
