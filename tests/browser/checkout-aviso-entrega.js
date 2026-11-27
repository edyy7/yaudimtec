const { chromium } = require(process.env.PLAYWRIGHT_PATH||'/opt/npm-tools/node_modules/playwright');
(async()=>{
  const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:390,height:844}}); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
  await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
  await p.addInitScript(()=>{ if(localStorage.getItem('seeded'))return; localStorage.setItem('seeded','1');
    localStorage.setItem('pf-sess',JSON.stringify({uid:'u1',email:'d@t.com'}));
    localStorage.setItem('agenda-v6:u1',JSON.stringify({nome:'Loja Teste',modo:'cardapio',slug:'loja-teste',wpp:'27999998888',services:[{id:1,name:'Pizza Mussarela',price:30,dur:0}],mods:{kds:true,garcom:false,entrega:true},orders:[]}));});
  await p.goto('http://localhost:8099/app/adm/index.html?op=adm'); await p.waitForTimeout(1800);
  const vis=async s=>await p.evaluate(s=>{var e=document.querySelector(s);return !!(e&&e.offsetParent)},s);
  const err=async()=>await p.evaluate(()=>(document.getElementById('er')||{}).textContent||'');
  const toCheckout=async()=>{ await p.evaluate(()=>{VC=true;C={step:1,sid:null,date:null,time:null,my:new Date(),msg:"",cart:[]};render()}); await p.click('[data-view]'); await p.click('[data-addcart]'); await p.click('[data-cont]'); await p.waitForTimeout(200); await p.fill('#cn','Maria Silva'); await p.fill('#cp','27999990000'); };
  const book=async()=>{ await p.click('[data-book]'); await p.waitForTimeout(250); };
  // A) retirada
  await toCheckout();
  console.log('A aviso oculto na retirada:',!(await vis('#avEnt')));
  await book(); console.log('A retirada confirma sem aceite -> tela:',(await p.evaluate(()=>document.querySelector('#app h1').innerText)),'| obs gravada:',JSON.stringify(await p.evaluate(()=>S.orders[0].obs)));
  // B) entrega sem marcar
  await toCheckout(); await p.selectOption('#ce','entrega'); console.log('B aviso aparece ao escolher entrega:',await vis('#avEnt'));
  await p.fill('#ca','Rua das Flores 120, Centro'); await book(); console.log('B sem checkbox ->',await err(),'| pedidos:',await p.evaluate(()=>S.orders.length));
  // C) endereço sem número, sem referência
  await p.fill('#ca','Viela do Morro, Centro'); await p.check('#cac'); await book(); console.log('C sem referência ->',await err(),'| pedidos:',await p.evaluate(()=>S.orders.length));
  // D) completo, fora do padrão
  await p.fill('#cr','Casa verde ao lado da quadra'); await p.fill('#co','sem cebola'); await book();
  const o=await p.evaluate(()=>S.orders[0]); console.log('D pedido gravado -> obs:',o.obs);
  const scr=await p.evaluate(()=>document.querySelector('#app').innerText); console.log('D confirmação repete aviso:',/Atenção, cliente/.test(scr),'| mostra aceite:',/confirmou estar ciente/.test(scr));
  const wa=await p.evaluate(()=>decodeURIComponent(document.querySelector('a.btn[href*="wa.me"]').href)); console.log('D WhatsApp inclui aviso:',/Atenção, cliente: para segurança/.test(wa),'| ref:',/Ponto de referência: Casa verde/.test(wa),'| aceite:',/Cliente ciente das condições/.test(wa));
  // E) endereço normal -> sem flag
  await toCheckout(); await p.selectOption('#ce','entrega'); await p.fill('#ca','Rua das Flores 120, Centro'); await p.check('#cac'); await book();
  console.log('E endereço normal -> obs:',await p.evaluate(()=>S.orders[0].obs));
  // F) recibo e cartão da loja
  const rec=await p.evaluate(async()=>{var by=await makeRecibo(S.orders[1]);return by.length});
  console.log('F recibo PDF gerado (bytes):',rec>1000);
  await p.evaluate(()=>{VC=false;tab='reservas';OSUB='ped';render()}); await p.waitForTimeout(400);
  const card=await p.evaluate(()=>document.querySelector('#app').innerText); console.log('F cartão da loja mostra alerta:',/Confirmar acesso antes de aceitar/.test(card),'| mostra Obs com aceite:',/Cliente ciente das condições/.test(card));
  console.log(errs.join('\n')||'sem erros de página'); await b.close();
})();
