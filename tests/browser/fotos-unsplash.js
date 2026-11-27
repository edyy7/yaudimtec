const { chromium } = require(process.env.PLAYWRIGHT_PATH||'/opt/npm-tools/node_modules/playwright');
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64');
(async()=>{
  const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:390,height:844}}); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
  const unsReq=[];
  await p.route(/^https?:\/\/(?!localhost)/,r=>{ if(/images\.unsplash\.com/.test(r.request().url())){unsReq.push(r.request().url().slice(0,70)); r.fulfill({status:200,contentType:'image/png',body:PNG})} else r.abort()});
  await p.addInitScript(()=>{ if(localStorage.getItem('seeded'))return; localStorage.setItem('seeded','1');
    localStorage.setItem('pf-sess',JSON.stringify({uid:'u1',email:'d@t.com'}));
    localStorage.setItem('agenda-v6:u1',JSON.stringify({nome:'Pizzaria Teste',modo:'cardapio',slug:'pz',services:[
      {id:1,name:'Mussarela',price:30,dur:0,emoji:'🍕',imgs:['/img/pizza/01.webp']},
      {id:3,name:'Portuguesa',price:34,dur:0,emoji:'🍕',imgs:['/img/pizza/03.webp']},
      {id:7,name:'Pepperoni',price:36,dur:0,emoji:'🍕',imgs:['/img/pizza/07.webp']}],mods:{kds:true,entrega:true},orders:[]}));});
  await p.goto('http://localhost:8099/app/adm/index.html?op=adm'); await p.waitForTimeout(1500);
  await p.evaluate(()=>{VC=true;render()}); await p.waitForTimeout(1200);
  const r=await p.evaluate(()=>[...document.querySelectorAll('#app [data-view]')].map(b=>{var i=b.querySelector('img');var ph=b.querySelector('.ph');return b.textContent.trim().slice(0,14)+' => '+(i?('FOTO '+(i.src.indexOf('unsplash')>-1?'unsplash':i.src.slice(-20))):(ph?'ÍCONE '+ph.textContent:'?'))}));
  console.log(r.join('\n')); console.log('requisições ao Unsplash:',unsReq.length,'(esperado 2: itens 01 e 07)');
  console.log(errs.join('\n')||'sem erros de página'); await b.close();
})();
