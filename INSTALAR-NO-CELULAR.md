# Instalar cada perfil como um app separado (v26)

## O que mudou nesta versão
1. **Cada perfil tem a sua própria página fixa** (`/app/adm/`, `/app/loja/`, `/app/cozinha/`, `/app/garcom/`, `/app/entregas/`) com o manifesto escrito no HTML. Antes o manifesto era criado por JavaScript depois que a página carregava, e o Chrome podia ler o errado.
2. **Cada perfil tem ícone, cor e nome próprios** (pasta `icons/`). Antes os 5 tinham o mesmo ícone "PF" e não dava para distinguir na tela do celular.
3. **Offline abre o próprio perfil**, não a home.
4. **O service worker não fica preso em versão velha** (`/sw.js` sem cache na Vercel).
5. Novo validador: `npm test` agora roda `tests/instalacao.test.js` (pacotes, ícones, escopos, rotas, offline).

Depois de mexer no `index.html`, rode `node scripts/gerar-perfis.js` para atualizar as 5 páginas (o teste avisa se esquecer).

## Caminho recomendado: um APK por perfil
Instalar pelo Chrome (PWA) divide o armazenamento e o login do mesmo site entre todos os apps. O APK separa de verdade (pacote próprio).
- Com login pelas contas do Android: `nativo/` (precisa do ID do cliente Web em `PF_GOOGLE_WEB_CLIENT_ID`, hoje vazio).
- Mais simples: `twa/` (Bubblewrap). Depois preencha `/.well-known/assetlinks.json` com o SHA-256 de cada APK.

## Conferência no celular (leva 5 minutos, depois do deploy)
Para cada perfil, desinstale versões antigas, abra o endereço, instale e confira:
| Perfil | Endereço | Ícone/cor | Abre em |
|---|---|---|---|
| ADM | /app/adm/?op=adm | roxo "ADM" | painel ADM |
| Loja | /app/loja/?op=ped | vermelho "LOJA" | Pedidos |
| Cozinha | /app/cozinha/?op=kds | laranja "COZ" | fila da cozinha |
| Garçom | /app/garcom/?op=garcom | verde "GAR" | Mesas |
| Entregas | /app/entregas/?op=ent | azul "ENT" | Entregas |
Deve aparecer 5 ícones diferentes na tela. Abrir um não pode abrir outro.
