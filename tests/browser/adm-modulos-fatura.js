const { chromium } = require(process.env.PLAYWRIGHT_PATH||'/opt/npm-tools/node_modules/playwright');
(async()=>{
  const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:390,height:844}}); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
  await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
  await p.addInitScript(()=>{ if(localStorage.getItem('seeded'))return; localStorage.setItem('seeded','1');
    localStorage.setItem('pf-sess',JSON.stringify({uid:'u1',email:'dono@teste.com'}));
    localStorage.setItem('agenda-v6:u1',JSON.stringify({nome:'Loja Teste',modo:'cardapio',slug:'loja-teste',services:[{id:1,name:'Pizza',price:30}],mods:{kds:true,garcom:true,entrega:false},orders:[]}));});
  await p.goto('http://localhost:8099/app/adm/index.html?op=adm'); await p.waitForTimeout(1800);
  const txt=async()=>await p.evaluate(()=>document.querySelector('#app').innerText);
  // Apps: sem card ADM
  await p.evaluate(()=>{tab='apps';render()}); await p.waitForTimeout(300);
  let t=await txt(); console.log('APPS tem ADM?',/Yaudimtec ADM/.test(t),'| tem Loja/Cozinha/Cliente:',/Yaudimtec Loja/.test(t),/Yaudimtec Cozinha/.test(t),/Yaudimtec Cliente/.test(t));
  // Módulos
  await p.evaluate(()=>{[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Módulos').click()}); await p.waitForTimeout(400);
  t=await txt(); console.log('MÓDULOS:',t.slice(0,900).replace(/\n/g,' | '));
  // ativar módulo -> confirm
  let dlg=''; p.on('dialog',d=>{dlg=d.message();d.dismiss()});
  const before=await p.evaluate(()=>JSON.stringify(S.mods));
  await p.evaluate(()=>{const e=document.querySelector('[data-pfmod="entrega"]');e&&e.click()}); await p.waitForTimeout(300);
  console.log('confirm exibido:',dlg||'(nenhum)','| mods antes/depois(cancelou):',before,await p.evaluate(()=>JSON.stringify(S.mods)));
  p.removeAllListeners('dialog'); p.on('dialog',d=>d.accept());
  await p.evaluate(()=>{const e=document.querySelector('[data-pfmod="entrega"]');e&&e.click()}); await p.waitForTimeout(300);
  console.log('após aceitar:',await p.evaluate(()=>JSON.stringify(S.mods)),'extra=',await p.evaluate(()=>pfModExtra()));
  // fatura
  const fat=await p.evaluate(()=>{CRI={valor:100,pix:'chave@pix.com',nome:'Yaudimtec',cid:'Vitoria'};PLANO={st:'none'};var h=subCard();var d=document.createElement('div');d.innerHTML=h;return d.innerText});
  console.log('FATURA:',fat.replace(/\n/g,' | ').slice(0,500));
  console.log(errs.join('\n')||'sem erros de página'); await b.close();
})();
