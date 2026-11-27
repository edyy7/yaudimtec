const { chromium } = require(process.env.PLAYWRIGHT_PATH||'/opt/npm-tools/node_modules/playwright');
(async()=>{
  const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:390,height:844}}); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
  await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
  let mode=[],calls=[];
  await p.route('**/api/mesa',async r=>{const body=JSON.parse(r.request().postData()||'{}');const st=mode.length?mode.shift():200;calls.push({st,tt:body.pedido&&body.pedido.tt,auth:(r.request().headers()['authorization']||'').length});
    await r.fulfill({status:st,contentType:'application/json',body:JSON.stringify(st===200?{pedido:{id:1}}:{erro:'x'})})});
  await p.addInitScript(()=>{ if(localStorage.getItem('seeded'))return; localStorage.setItem('seeded','1');
    localStorage.setItem('pf-sess',JSON.stringify({uid:'u1',email:'dono@teste.com'}));
    localStorage.setItem('agenda-v6:u1',JSON.stringify({nome:'Loja Teste',modo:'cardapio',slug:'loja-teste',services:[{id:1,name:'Pizza',price:30}],mods:{kds:true,garcom:true},orders:[]}));});
  await p.goto('http://localhost:8099/app/adm/index.html?op=adm'); await p.waitForTimeout(1800);
  await p.evaluate(()=>{window.__fr=[];window.__so=0;window.firebase={auth:()=>({currentUser:{getIdToken:(f)=>{window.__fr.push(!!f);return Promise.resolve('t'.repeat(40))}},signOut:()=>{window.__so++}})}});
  const run=(label,seq,pedido)=>p.evaluate(([pedido])=>new Promise(res=>pfMesaRetry("pedido",{pedido:pedido},(ok,j,st)=>res({ok,j,st})),),[pedido]);
  const ped=tt=>({id:Date.now(),tt:tt.repeat(32).slice(0,32),mesa:'Mesa 1',obs:'',pess:[{nome:'A',lin:[{id:1,q:1}]}]});
  mode=[503,503]; calls=[]; let r=await run('A',mode,ped('a')); console.log('A 503,503,200 ->',JSON.stringify(r),'chamadas:',calls.map(c=>c.st).join(','));
  mode=[401]; calls=[]; await p.evaluate(()=>{window.__fr=[]}); r=await run('B',mode,ped('b')); console.log('B 401,200 ->',r.ok,'getIdToken(force):',JSON.stringify(await p.evaluate(()=>window.__fr)));
  mode=[400]; calls=[]; r=await run('D',mode,ped('d')); console.log('D 400 -> sem retry:',calls.length===1,'ok=',r.ok,'queued=',!!(r.j&&r.j.queued),'outbox=',await p.evaluate(()=>pfMesaOutGet().length));
  mode=[500,500,500]; calls=[]; const pc=ped('c'); r=await run('C',mode,pc); console.log('C 500x3 -> queued=',!!(r.j&&r.j.queued),'outbox=',await p.evaluate(()=>pfMesaOutGet().length),'chamadas',calls.length);
  mode=[]; calls=[]; await p.evaluate(()=>{window.pfMesaFlush()}); await p.waitForTimeout(800);
  console.log('   flush -> chamadas:',calls.map(c=>c.st+':'+c.tt.slice(0,3)).join(','),'| outbox=',await p.evaluate(()=>pfMesaOutGet().length));
  // motoboy
  await p.evaluate(()=>{STAFF={oid:'u1',uid:'m1',papel:'ent',st:'aprovado'};pfEntRec({id:11});pfEntRec({id:12});pfEntRec({id:11})});
  const rs=await p.evaluate(()=>{var d=document.createElement('div');d.innerHTML=pfEntResumo();return d.innerText.replace(/\n/g,' | ')});
  console.log('MOTOBOY:',rs);
  // tema do staff
  await p.evaluate(()=>{DB.get=function(pth,cb){cb({data:JSON.stringify({theme:{c1:'#123456',c2:'#654321',grad:false}})})};staffTheme()});
  console.log('TEMA staff --pri:',await p.evaluate(()=>document.documentElement.style.getPropertyValue('--pri')),'| meta theme-color:',await p.evaluate(()=>(document.querySelector('meta[name="theme-color"]')||{}).content));
  // saída trava sessão
  await p.evaluate(()=>{localStorage.setItem('pf-staff',JSON.stringify({oid:'u1',papel:'ent'}));try{staffExit()}catch(e){window.__exErr=e.message}});
  console.log('SAIR: signOut chamado=',await p.evaluate(()=>window.__so),'pf-staff limpo=',await p.evaluate(()=>!localStorage.getItem('pf-staff')),'erro=',await p.evaluate(()=>window.__exErr||'nenhum'));
  console.log(errs.join('\n')||'sem erros de página'); await b.close();
})();
