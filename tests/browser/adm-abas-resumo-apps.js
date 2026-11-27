const { chromium } = require(process.env.PLAYWRIGHT_PATH||'/opt/npm-tools/node_modules/playwright');
(async()=>{
  const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:390,height:844}}); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
  await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
  const now=Date.now();
  await p.addInitScript(([now])=>{
    if(localStorage.getItem('seeded'))return; localStorage.setItem('seeded','1');
    localStorage.setItem('pf-sess',JSON.stringify({uid:'u1',email:'dono@teste.com'}));
    localStorage.setItem('agenda-v6:u1',JSON.stringify({nome:'Loja Teste',modo:'cardapio',slug:'loja-teste',services:[{id:1,name:'Pizza',price:30}],
      mods:{kds:true,garcom:true,entrega:false},
      orders:[{id:now-1000,st:'ok',fase:'entregue',total:60,pay:'pix',items:[{id:1,q:2}],nome:'Ana',total_cents:6000},{id:now-2000,st:'ok',fase:'entregue',total:30,pay:'dinheiro',nome:'Bia'}]}));
  },[now]);
  await p.goto('http://localhost:8099/app/adm/index.html?op=adm'); await p.waitForTimeout(1800);
  const txt=async()=>await p.evaluate(()=>document.querySelector('#app').innerText);
  let t=await txt();
  console.log('TELA INICIAL:', t.slice(0,700).replace(/\n/g,' | '));
  console.log('tab=',await p.evaluate(()=>tab));
  console.log('tem Faturamento bruto na inicial:',/Faturamento bruto/.test(t),' Ticket médio:',/Ticket médio/.test(t),' Pix:',/Pix/.test(t),' Quebra de caixa:',/Quebra/.test(t),' Comiss:',/omiss/.test(t));
  await p.screenshot({path:'/tmp/t/adm-resumo.png'});
  // ordem das abas
  console.log('ABAS:', await p.evaluate(()=>[...document.querySelectorAll('nav button, .tabs button, [data-tab]')].map(e=>e.textContent.trim()).filter(Boolean).slice(0,14).join(' | ')));
  // Contábil
  await p.evaluate(()=>{tab='contab';render()}); await p.waitForTimeout(500);
  t=await txt(); console.log('CONTÁBIL tem bloco financeiro?',/Faturamento bruto|Ticket médio|Quebra de caixa/.test(t),'| início:',t.slice(0,200).replace(/\n/g,' | '));
  // Apps
  await p.evaluate(()=>{tab='apps';render()}); await p.waitForTimeout(500);
  t=await txt(); console.log('APPS:', t.slice(0,900).replace(/\n/g,' | '));
  console.log('barra instalar topo visível?', await p.evaluate(()=>{var e=document.getElementById('pfinst');return !!(e&&e.style.display!=='none'&&e.offsetParent)}));
  console.log(errs.join('\n')||'sem erros de página');
  await b.close();
})();
