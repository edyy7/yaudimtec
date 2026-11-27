const { chromium } = require(process.env.PLAYWRIGHT_PATH||'/opt/npm-tools/node_modules/playwright');
(async()=>{
  const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:390,height:844}}); const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
  await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
  await p.goto('http://localhost:8099/index.html'); await p.waitForTimeout(1500);
  await p.evaluate(()=>{
    window.__db={'slugs/loja-x':{uid:'c1'},'contas/c1':{uid:'c1'},'slugs/loja-z':{uid:'OUTRO'},'contas/c3':{uid:'c3'}};window.__log=[];
    DB.get=function(p,cb){cb(window.__db[p]||null)};
    DB.del=function(p,cb){window.__log.push(p);delete window.__db[p];if(cb)cb(true)};
    SUPER=true;OWNER=true;ACCT={uid:'sup1',email:'criador@teste.com'};STAB='loj';var ate=Date.now()+1e9;
    LOJ=[{uid:'c1',nome:'Loja X',slug:'loja-x',email:'a@b.c',plano:{st:'ok',ate:ate}},{uid:'c2',nome:'Loja Y',slug:'loja-y',email:'y@b.c',plano:{st:'ok',ate:ate}},{uid:'c3',nome:'Loja Z',slug:'loja-z',email:'z@b.c',plano:{st:'ok',ate:ate}}];
    render=function(){document.querySelector('#app').innerHTML=superView()}; render()});
  const state=async()=>await p.evaluate(()=>({lista:LOJ.map(x=>x.nome).join(','),apagados:window.__log.join(',')||'(nada)'}));
  console.log('botões Remover:',await p.evaluate(()=>document.querySelectorAll('[data-pflrm]').length),'|',JSON.stringify(await state()));
  let msg='',resp='nao'; p.on('dialog',d=>{ if(d.type()==='confirm'){msg=d.message(); d.accept()} else d.accept(resp)});
  resp='nao'; await p.click('[data-pflrm="c1"]'); await p.waitForTimeout(200);
  console.log('1 digitou errado -> nada removido:',JSON.stringify(await state()));
  console.log('  aviso exibido:',msg.replace(/\n/g,' '));
  resp='REMOVER'; await p.click('[data-pflrm="c1"]'); await p.waitForTimeout(300);
  console.log('2 REMOVER (loja com endereço próprio) ->',JSON.stringify(await state()));
  await p.click('[data-pflrm="c3"]'); await p.waitForTimeout(300);
  console.log('3 loja cujo endereço é de outro uid -> não apaga o endereço alheio:',JSON.stringify(await state()));
  console.log(errs.join('\n')||'sem erros de página'); await b.close();
})();
