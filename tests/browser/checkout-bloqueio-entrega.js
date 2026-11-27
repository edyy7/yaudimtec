const { chromium } = require(process.env.PLAYWRIGHT_PATH||'/opt/npm-tools/node_modules/playwright');
(async()=>{
  const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:390,height:844}}); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
  await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
  await p.addInitScript(()=>{ if(localStorage.getItem('seeded'))return; localStorage.setItem('seeded','1');
    localStorage.setItem('pf-sess',JSON.stringify({uid:'u1',email:'d@t.com'}));
    localStorage.setItem('agenda-v6:u1',JSON.stringify({nome:'Loja Teste',modo:'cardapio',slug:'lt',wpp:'27999998888',services:[{id:1,name:'Pizza',price:30,dur:0}],mods:{kds:true,garcom:false,entrega:true},orders:[]}));});
  await p.goto('http://localhost:8099/app/adm/index.html?op=adm'); await p.waitForTimeout(1800);
  const err=async()=>await p.evaluate(()=>(document.getElementById('er')||{}).textContent||'');
  const toCheckout=async()=>{ await p.evaluate(()=>{VC=true;C={step:1,sid:null,date:null,time:null,my:new Date(),msg:"",cart:[]};render()}); await p.click('[data-view]'); await p.click('[data-addcart]'); await p.click('[data-cont]'); await p.waitForTimeout(200); await p.fill('#cn','Maria'); await p.fill('#cp','27999990000'); await p.selectOption('#ce','entrega'); };
  const book=async()=>{ await p.click('[data-book]'); await p.waitForTimeout(250); };
  // 1) interruptor na aba Módulos
  await p.evaluate(()=>{tab='mods';render()}); await p.waitForTimeout(300);
  console.log('1 interruptor aparece (entrega ligada):',await p.evaluate(()=>!!document.querySelector('[data-pfbloq]')),'| padrão desligado:',await p.evaluate(()=>!S.entBloq));
  await p.click('[data-pfbloq]'); await p.waitForTimeout(200);
  console.log('  ligou ->',await p.evaluate(()=>S.entBloq),'| aria-checked:',await p.evaluate(()=>document.querySelector('[data-pfbloq]').getAttribute('aria-checked')),'| vai na cópia pública:',await p.evaluate(()=>pubCopy().entBloq));
  // 2) endereço fora do padrão sem confirmar -> barra
  await toCheckout(); await p.fill('#ca','Viela do Morro, Centro'); await p.check('#cac'); await p.fill('#cr','Casa verde'); await book();
  console.log('2 fora do padrão sem "desço para receber" ->',await err(),'| pedidos:',await p.evaluate(()=>S.orders.length));
  await p.check('#cdb'); await book();
  console.log('  com confirmação -> pedido:',await p.evaluate(()=>S.orders.length),'| obs:',await p.evaluate(()=>S.orders[0].obs));
  // 3) endereço normal com bloqueio ligado -> não exige
  await toCheckout(); await p.fill('#ca','Rua das Flores 120, Centro'); await p.check('#cac'); await book();
  console.log('3 endereço normal -> pedido:',await p.evaluate(()=>S.orders.length),'| obs:',await p.evaluate(()=>S.orders[0].obs));
  // 4) bloqueio desligado -> volta ao comportamento anterior
  await p.evaluate(()=>{S.entBloq=false});
  await toCheckout(); console.log('4 bloqueio desligado: caixa extra oculta:',!(await p.evaluate(()=>!!document.getElementById('cdb'))));
  await p.fill('#ca','Viela do Morro, Centro'); await p.check('#cac'); await p.fill('#cr','Casa verde'); await book();
  console.log('  fora do padrão passa só com aviso -> pedidos:',await p.evaluate(()=>S.orders.length),'| obs:',await p.evaluate(()=>S.orders[0].obs));
  console.log(errs.join('\n')||'sem erros de página'); await b.close();
})();
