const { chromium } = require(process.env.PLAYWRIGHT_PATH||'/opt/npm-tools/node_modules/playwright');
(async()=>{
  const b=await chromium.launch(); const p=await b.newPage();
  await p.route(/^https?:\/\/(?!localhost)/,r=>r.abort());
  await p.goto('http://localhost:8099/index.html'); await p.waitForTimeout(1200);
  const out=await p.evaluate(()=>{
    const res=[];
    SEGS.forEach(function(sg){
      sg[1].forEach(function(k){
        var n=NICHOS[k]; if(!n) return;
        var items;
        if(n.length>2){ items=n[1].split(";").map(function(t){var a=t.split(":");return {nome:a[0],emoji:a[4]||n[3]}}); }
        else { items=n[1].map(function(t){var a=t.split("|");return {nome:a[0],emoji:a[3]}}); }
        res.push({grupo:sg[0],k:k,nome:(typeof HL!=="undefined"&&HL[k])||n[0],modo:n.length>2?n[2]:"agenda",itens:items});
      });
    });
    return res;
  });
  require('fs').writeFileSync('/tmp/t/niches.json',JSON.stringify(out,null,1));
  console.log(out.length,'negócios;',out.reduce((a,x)=>a+x.itens.length,0),'itens');
  out.forEach(x=>console.log(x.k.padEnd(10),String(x.itens.length).padStart(2),x.modo.padEnd(8),x.nome,'|',x.itens.slice(0,3).map(i=>i.nome).join(', ')));
  await b.close();
})();
