// Simulação do /api/mesa com um Firestore REST falso em memória
const DB = {}; let TX = 0;
const P = "projects/delivery-67d14/databases/(default)/documents/";
const S = { nome:"Loja", modo:"cardapio", mods:{kds:true,garcom:true,entrega:true}, services:[{id:1,name:"Pizza",price:30},{id:2,name:"Suco",price:8,estoque_atual:10}] };
DB["pf_lojas_publicas/own1234"] = { data:{stringValue:JSON.stringify(S)} };
DB["pf_lojas/own1234/equipe/gar1"] = { status:{stringValue:"aprovado"}, papel:{stringValue:"mesas"}, nome:{stringValue:"Ze"} };
const calls=[];
global.fetch = async (url, o={}) => {
  url = String(url); const m=(o.method||"GET");
  calls.push(m+" "+url.replace("https://firestore.googleapis.com/v1/"+P,"").slice(0,90));
  const J=(code,obj)=>({ok:code<300,status:code,json:async()=>obj});
  if (url.includes("identitytoolkit")) return J(200,{users:[{localId:"gar1"}]});
  if (url.includes("oauth2")) return J(200,{access_token:"x",expires_in:3600});
  if (url.endsWith(":beginTransaction")) return J(200,{transaction:"t"+(++TX)});
  if (url.endsWith(":rollback")) return J(200,{});
  if (url.endsWith(":commit")) { const w=JSON.parse(o.body).writes; for(const x of w){ if(x.update){const p=x.update.name.split(P)[1]; if(x.currentDocument&&x.currentDocument.exists===false&&DB[p]) return J(409,{error:{status:"ALREADY_EXISTS"}}); DB[p]=Object.assign(DB[p]||{},x.update.fields||{}); if(x.updateTransforms){DB[p].q={integerValue:String((+(DB[p].q&&DB[p].q.integerValue)||0)+ +x.updateTransforms[0].increment.integerValue)}}}} return J(200,{}); }
  if (url.includes(":runQuery")) return J(200,[{}]);
  if (m==="POST") { const u=new URL(url); const col=u.pathname.split("/documents/")[1]; const id=u.searchParams.get("documentId"); const p=col+"/"+id; if(DB[p]) return J(409,{}); DB[p]=JSON.parse(o.body).fields; return J(200,{}); }
  const u=new URL(url); const p=decodeURIComponent(u.pathname.split("/documents/")[1]);
  if (DB[p]) return J(200,{fields:DB[p]}); return J(404,{});
};
process.env.PF_SA_JSON = Buffer.from(JSON.stringify({client_email:"a@b",private_key:require("crypto").generateKeyPairSync("rsa",{modulusLength:2048,privateKeyEncoding:{type:"pkcs8",format:"pem"},publicKeyEncoding:{type:"spki",format:"pem"}}).privateKey})).toString("base64");
const mesa = require(require("path").join(__dirname,"../../api/mesa.js"));
async function run(label, pedido){
  let out; const res={setHeader(){},status(c){return {json(o){out={c,o}}}}};
  await mesa({method:"POST",headers:{authorization:"Bearer "+"a".repeat(30)},body:{acao:"pedido",oid:"own1234",nome:"Ze",pedido}},res);
  console.log(label, JSON.stringify(out).slice(0,300));
}
(async()=>{
  const tt="a".repeat(32), id=Date.now();
  await run("sem estoque:", {id,tt,mesa:"Mesa 1",obs:"",pess:[{nome:"Ana",lin:[{id:1,q:2}]}]});
  await run("com estoque:", {id:id+1,tt:"b".repeat(32),mesa:"Mesa 2",obs:"",pess:[{nome:"Ana",lin:[{id:2,q:2}]}]});
  console.log(calls.slice(-14).join("\n"));
})();
