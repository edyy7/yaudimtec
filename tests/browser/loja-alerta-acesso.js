const { chromium } = require(process.env.PLAYWRIGHT_PATH||'/opt/npm-tools/node_modules/playwright');
(async()=>{
  const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:390,height:844}}); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
  await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
  const now=Date.now();
  await p.addInitScript(([now])=>{ if(localStorage.getItem('seeded'))return; localStorage.setItem('seeded','1');
    localStorage.setItem('pf-sess',JSON.stringify({uid:'u1',email:'d@t.com'}));
    localStorage.setItem('agenda-v6:u1',JSON.stringify({nome:'Loja Teste',modo:'cardapio',slug:'loja-teste',wpp:'27999998888',services:[{id:1,name:'Pizza Mussarela',price:30,dur:0}],mods:{kds:true,garcom:false,entrega:true},
      orders:[{id:now,name:'Maria',phone:'27999990000',items:'1x Pizza Mussarela',total:30,sinal:0,tipo:'sinal',pag:'local',ent:'entrega',addr:'Viela do Morro',obs:'[CONFIRMAR ACESSO ANTES DE ACEITAR] Ref: Casa verde. Cliente ciente das condições de entrega (aceite 27/11/2026 01:44).',st:'ok',fase:'novo'}]}));},[now]);
  await p.goto('http://localhost:8099/app/loja/index.html?op=ped'); await p.waitForTimeout(1800);
  for (const [t,o] of [['reservas','ped'],['reservas','kds']]) {
    await p.evaluate(([t,o])=>{tab=t;OSUB=o;render()},[t,o]); await p.waitForTimeout(400);
    const card=await p.evaluate(()=>document.querySelector('#app').innerText);
    console.log(t+'/'+o,'-> alerta:',/Confirmar acesso antes de aceitar/.test(card),'| obs:',/Cliente ciente das condições/.test(card),'| início:',card.slice(0,160).replace(/\n/g,' | '));
  }
  console.log(errs.join('\n')||'sem erros de página'); await b.close();
})();
