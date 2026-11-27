#!/bin/sh
# Uso (na raiz do projeto):  sh tests/browser/rodar.sh adm-abas-resumo-apps.js
# Sobe um servidor estático em :8099, roda o script (Playwright/Chromium, sem internet) e derruba o servidor.
# Se o Playwright estiver em outro lugar: PLAYWRIGHT_PATH=/caminho/node_modules/playwright sh tests/browser/rodar.sh <arquivo>
cd "$(dirname "$0")/../.." || exit 1
python3 -m http.server 8099 >/dev/null 2>&1 &
SRV=$!
sleep 1.5
node "tests/browser/$1"
RC=$?
kill $SRV 2>/dev/null
exit $RC
