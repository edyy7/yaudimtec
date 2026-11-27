#!/usr/bin/env python3
"""Gera docs/INDICE-DE-FUNCOES.md a partir do index.html (funções e variáveis globais com número de linha).
Rode depois de qualquer mudança no app:  python3 tools/gerar-indice.py"""
import re,datetime
s=open("index.html",encoding="utf-8").read().split("\n")
fn=[];gl=[]
for i,l in enumerate(s,1):
    for m in re.finditer(r'(?:^|[;{}\s])function\s+([A-Za-z_$][\w$]*)\s*\(',l): fn.append((i,m.group(1)))
    for m in re.finditer(r'(?:^|[;{}\s])var\s+((?:[A-Z][A-Z0-9_]{2,})|PF_[A-Za-z0-9_]+)\s*=',l): gl.append((i,m.group(1)))
out=["# Índice de funções e globais do index.html","",
"Gerado por `tools/gerar-indice.py` em %s. Linhas valem para `index.html` (as 5 cópias em app/*/ têm o mesmo corpo; os números mudam só pelo <head>, ~+9 linhas). Use `grep -n \"function nome(\"`."%datetime.date.today().isoformat(),"",
"Total: %d funções, %d variáveis globais em %d linhas."%(len(fn),len(gl),len(s)),"","## Funções (linha nome)",""]
row=[]
for i,n in fn:
    row.append("L%d %s"%(i,n))
    if len(row)==6: out.append(" · ".join(row)); row=[]
if row: out.append(" · ".join(row))
out+=["","## Variáveis globais (linha nome)",""]
row=[]
for i,n in gl:
    row.append("L%d %s"%(i,n))
    if len(row)==6: out.append(" · ".join(row)); row=[]
if row: out.append(" · ".join(row))
open("docs/INDICE-DE-FUNCOES.md","w",encoding="utf-8").write("\n".join(out)+"\n")
print(len(fn),"funções,",len(gl),"globais ->docs/INDICE-DE-FUNCOES.md")
