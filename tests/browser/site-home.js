// Home de vendas (nova, 27/11/2026): aplicativos em destaque, site/Google como secundário. Uso: sh tests/browser/rodar.sh site-home.js
const { chromium } = require(process.env.PLAYWRIGHT_PATH||'/opt/npm-tools/node_modules/playwright');
(async()=>{
  const b=await chromium.launch(); let ok=true; const chk=(n,c)=>{console.log((c?'OK  ':'FALHA ')+n); if(!c) ok=false};
  for (const [nome,w,h] of [['mobile',390,844],['desktop',1280,900]]){
    const p=await b.newPage({viewport:{width:w,height:h}}); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
    await p.goto('http://localhost:8099/index.html'); await p.waitForTimeout(1500);
    const m=await p.evaluate(()=>{const t=document.querySelector('.yh');return {yh:!!t,apps:document.querySelectorAll('.yh-app').length,chips:document.querySelectorAll('[data-hn]').length,sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,
      iApps:document.querySelector('#aplicativos').getBoundingClientRect().top, iSite:document.querySelector('#site-google').getBoundingClientRect().top}});
    chk(nome+': home nova aparece',m.yh); chk(nome+': 8 aplicativos',m.apps===8); chk(nome+': 21 nichos',m.chips===21);
    chk(nome+': sem rolagem lateral',m.sw<=m.cw); chk(nome+': aplicativos vêm antes de site/Google',m.iApps<m.iSite); chk(nome+': sem erro de página',errs.length===0);
    await p.close();
  }
  await b.close(); process.exit(ok?0:1);
})();
