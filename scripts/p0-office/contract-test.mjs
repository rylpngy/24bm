// This is a callback contract test with a mock byte server, not an online editing test.
import fs from 'node:fs/promises';import http from 'node:http';import {spawn} from 'node:child_process';import {createHmac,createHash} from 'node:crypto';import assert from 'node:assert/strict';
const dir='.p0/office-contract';await fs.mkdir(dir,{recursive:true});await fs.rm(dir+'/browser-session.json',{force:true});await fs.rm(dir+'/revision-2.docx',{force:true});const bytes=await fs.readFile('.p0/office/fixture.docx');await fs.writeFile(dir+'/fixture.docx',bytes);
let src=await fs.readFile('scripts/p0-office/server.mjs','utf8');src=src.replaceAll('18088','28090').replaceAll('18089','28091');await fs.writeFile('scripts/p0-office/.contract-server.mjs',src);
const fileServer=http.createServer((req,res)=>{if(req.url==='/cache/files/mock.docx'){res.end(bytes)}else{res.writeHead(404);res.end()}}).listen(28090,'127.0.0.1');
const child=spawn(process.execPath,['scripts/p0-office/.contract-server.mjs'],{env:{...process.env,P0_OFFICE_RUNTIME_DIR:dir},stdio:'ignore'});
try{
 let session;for(let i=0;i<50;i++){try{session=JSON.parse(await fs.readFile(dir+'/browser-session.json'));const response=await fetch(session.url);if(response.status!==200)throw Error('not ready');break}catch{session=undefined;}await new Promise(r=>setTimeout(r,100));}assert.ok(session);
 const env=Object.fromEntries((await fs.readFile('.p0/office.env','utf8')).trim().split('\n').map(l=>l.split('=')));const sign=p=>{const h=Buffer.from(JSON.stringify({alg:'HS256'})).toString('base64url'),v=Buffer.from(JSON.stringify(p)).toString('base64url');const s=h+'.'+v;return s+'.'+createHmac('sha256',env.JWT_SECRET).update(s).digest('base64url')};
 // Read the synthetic document key from the signed page configuration, not from service internals.
 const response=await fetch(session.url);assert.equal(response.status,200);const html=await response.text();const found=html.match(/"key":"([^"]+)"/);if(!found)console.error("html prefix",html.slice(0,180),"length",html.length);const key=found[1];const b={key,status:6,url:'http://127.0.0.1:28090/cache/files/mock.docx'};
 const post=(body,token)=>fetch('http://127.0.0.1:28091/callback',{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});
 assert.equal((await post(b)).status,403);assert.equal((await post(b,'bad')).status,403);
 assert.equal((await post({...b,status:2},sign(b))).status,403);
 assert.equal((await post({...b,key:'wrong'},sign({...b,key:'wrong'}))).status,409);
 const external={...b,url:'http://example.com/cache/files/mock.docx'};assert.equal((await post(external,sign(external))).status,403);
 assert.equal((await post(b,sign(b))).status,200);assert.deepEqual(await fs.readFile(dir+'/revision-2.docx'),bytes);
 assert.equal((await post(b,sign(b))).status,200);
 const stateUrl=`http://127.0.0.1:28091/state?access=${session.access}`;const state=await (await fetch(stateUrl)).json();assert.equal(state.revision,2);assert.equal(state.versions.length,1);
 await fetch(`http://127.0.0.1:28091/lock?access=${session.access}`);assert.equal((await post(b,sign(b))).status,409);
 assert.equal((await fetch('http://127.0.0.1:28091/')).status,403);assert.equal((await fetch('http://127.0.0.1:28091/source.docx')).status,403);
 console.log(JSON.stringify({kind:'mock callback contract, NOT actual editor save',checks:['missing JWT rejected','invalid JWT rejected','tampered signed fields rejected','wrong document key rejected','external download URL rejected','download bytes persisted before ack','duplicate callback creates no extra revision','locked revision rejected','anonymous editor rejected','anonymous source rejected'],sha256:createHash('sha256').update(bytes).digest('hex'),savedRevision:2},null,2));
}finally{child.kill();fileServer.close();await fs.rm('scripts/p0-office/.contract-server.mjs',{force:true});}
