#!/usr/bin/env python3
"""Aplica a MESMA correção nas 6 cópias do app (index.html + app/*/index.html).
As 6 cópias têm o mesmo corpo e só diferem no <head>. Regra do projeto: toda mudança no app entra nas 6.
Uso: copie este arquivo, escreva as trocas dentro de aplicar(R) e rode:  python3 tools/aplicar-em-6-copias.py
R(antigo, novo, vezes=1) falha (assert) se o trecho antigo não aparecer exatamente `vezes` vezes -> nada é gravado pela metade.
Dentro de strings JS do app as aspas e quebras de linha precisam de escape: ajuste o texto antes de trocar."""
import sys
FILES = ["index.html", "app/adm/index.html", "app/loja/index.html", "app/cozinha/index.html", "app/garcom/index.html", "app/entregas/index.html"]

def aplicar(R):
    # Exemplo (apague): R('texto antigo exato', 'texto novo')
    pass

def patch(path):
    s = open(path, encoding="utf-8").read()
    def R(old, new, cnt=1):
        nonlocal s
        assert s.count(old) == cnt, (path, old[:80], s.count(old))
        s = s.replace(old, new)
    aplicar(R)
    open(path, "w", encoding="utf-8").write(s)

if __name__ == "__main__":
    for f in FILES:
        patch(f); print("ok", f)
