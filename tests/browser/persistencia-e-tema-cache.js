const { chromium } = require(process.env.PLAYWRIGHT_PATH||'/opt/npm-tools/node_modules/playwright');
(async()=>{
  const b=await chromium.launch();
  const run=async(label,seed)=>{
    const ctx=await b.newContext({viewport:{width:390,height:844}}); const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
    await p.addInitScript(([seed])=>{ if(localStorage.getItem('seeded'))return; localStorage.setItem('seeded','1'); localStorage.setItem('pf-sess',JSON.stringify({uid:'u1',email:'d@t.com'})); for(const k in seed)localStorage.setItem(k,seed[k]);},[seed]);
    await p.goto('http://localhost:8099/app/adm/index.html?op=adm'); await p.waitForTimeout(1500);
    const r=await p.evaluate(()=>({nome:S.nome,n:(S.services||[]).length,key:KEY}));
    console.log(label,'->',JSON.stringify(r),errs.join('')||''); await ctx.close();
  };
  const good=JSON.stringify({nome:'Loja Recuperada',modo:'cardapio',slug:'x',services:[{id:1,name:'Pizza',price:30},{id:2,name:'Suco',price:8}]});
  await run('normal',{'agenda-v6:u1':good});
  await run('chave principal corrompida + .bak',{'agenda-v6:u1':'{quebrado','agenda-v6:u1.bak':good});
  await run('só chave de versão antiga (v5)',{'agenda-v5:u1':good});
  // cache de tema na abertura (cliente via ?loja=)
  const ctx=await b.newContext({viewport:{width:390,height:844}}); const p=await ctx.newPage();
  await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
  await p.addInitScript(()=>{localStorage.setItem('pf-theme',JSON.stringify({k:'loja-teste',t:{c1:'#0a7d33',c2:'#0a5d33',grad:false}}))});
  await p.goto('http://localhost:8099/index.html?loja=loja-teste'); await p.waitForTimeout(800);
  console.log('tema em cache aplicado na abertura (cliente): --pri =',await p.evaluate(()=>document.documentElement.style.getPropertyValue('--pri')));
  await b.close();
})();
