#!/bin/sh
# Conferência rápida depois de qualquer mudança (rode na raiz do projeto):
#  1) sintaxe dos scripts de cada cópia  2) as 5 cópias diferem do index.html só no <head> (13 linhas)  3) testes automáticos
cd "$(dirname "$0")/.." || exit 1
python3 - <<'PY'
import re,subprocess,tempfile,os
for f in ["index.html","app/adm/index.html","app/loja/index.html","app/cozinha/index.html","app/garcom/index.html","app/entregas/index.html"]:
    s=open(f,encoding="utf-8").read(); bad=0
    for m in re.finditer(r'<script(?![^>]*type="application/json")[^>]*>(.*?)</script>',s,re.S):
        t=tempfile.NamedTemporaryFile("w",suffix=".js",delete=False,encoding="utf-8"); t.write(m.group(1)); t.close()
        r=subprocess.run(["node","--check",t.name],capture_output=True,text=True); os.unlink(t.name)
        if r.returncode: bad+=1; print("ERRO",f,r.stderr[:200])
    print(f,"sintaxe ok" if not bad else "COM ERRO")
PY
for r in loja cozinha adm entregas garcom; do echo "$r: $(diff index.html app/$r/index.html | grep -c '^[<>]') linhas diferentes (esperado 13, só no head)"; done
node tests/fallback.test.js 2>&1 | tail -1
