import http from 'node:http';
import fs from 'node:fs/promises';
import {createHmac,timingSafeEqual,randomBytes,createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const dir=path.resolve(root,process.env.P0_OFFICE_RUNTIME_DIR||'.p0/office');await fs.mkdir(dir,{recursive:true});
const env=Object.fromEntries((await fs.readFile(path.join(root,'.p0/office.env'),'utf8')).trim().split('\n').map(l=>l.split('=')));
const secret=env.JWT_SECRET, access=randomBytes(24).toString('hex'), source=randomBytes(24).toString('hex');
const key='p0-'+Date.now();let locked=false,revision=1;const events=[],versions=[],seen=new Set();
const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const sign=p=>{const t=enc({alg:'HS256',typ:'JWT'})+'.'+enc(p);return t+'.'+createHmac('sha256',secret).update(t).digest('base64url');};
function verify(token){const [h,p,s]=String(token).split('.');const actual=Buffer.from(s||'','base64url');const expected=createHmac('sha256',secret).update(h+'.'+p).digest();if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw Error('bad signature');const header=JSON.parse(Buffer.from(h,'base64url'));if(header.alg!=='HS256')throw Error('bad algorithm');const v=JSON.parse(Buffer.from(p,'base64url'));if(v.exp&&v.exp<Date.now()/1000)throw Error('expired');return v.payload||v;}
const persist=()=>fs.writeFile(path.join(dir,'state.json'),JSON.stringify({key,revision,locked,events,versions},null,2));
function json(res,status,value){res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(value));}
async function body(req){const chunks=[];let size=0;for await(const b of req){size+=b.length;if(size>1024*1024)throw Error('body too large');chunks.push(b);}return JSON.parse(Buffer.concat(chunks).toString()||'{}');}
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost:18089');
 if(url.pathname==='/source.docx'){if(url.searchParams.get('token')!==source)return json(res,403,{});res.setHeader('content-type','application/vnd.openxmlformats-officedocument.wordprocessingml.document');return res.end(await fs.readFile(path.join(dir,'fixture.docx')));}
 if(url.pathname==='/callback'){
  const b=await body(req);let signed;try{signed=verify(req.headers.authorization?.replace(/^Bearer /i,'')||b.token);}catch{return json(res,403,{error:1});}
  for(const field of ['key','status','url'])if(b[field]!==undefined&&signed[field]!==b[field])return json(res,403,{error:1});
  if(b.key!==key)return json(res,409,{error:1});
  if(locked&&[2,6].includes(b.status))return json(res,409,{error:1});
  const eventKey=`${b.key}:${b.status}:${b.url||''}`;if(seen.has(eventKey))return json(res,200,{error:0});
  if([2,6].includes(b.status)){
   const remote=new URL(b.url);if(!['127.0.0.1','localhost','host.docker.internal'].includes(remote.hostname)||remote.port!=='18088'||!remote.pathname.startsWith('/cache/files/'))return json(res,403,{error:1});
   remote.hostname='127.0.0.1';const r=await fetch(remote,{redirect:'error',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('download failed');
   const bytes=Buffer.from(await r.arrayBuffer());if(bytes.length>20*1024*1024||bytes.toString('hex',0,2)!=='504b')throw Error('invalid document');
   const hash=createHash('sha256').update(bytes).digest('hex');
   if(!versions.some(v=>v.hash===hash)){const next=revision+1;await fs.writeFile(path.join(dir,`revision-${next}.docx`),bytes,{flag:'wx'});revision=next;versions.push({revision,hash,bytes:bytes.length});}
   // Private replay fixture contains the actual signed payload, never included in reports.
   await fs.writeFile(path.join(dir,'last-callback.json'),JSON.stringify({body:b,authorization:req.headers.authorization}),{mode:0o600});
  }
  events.push({status:b.status,revision});seen.add(eventKey);await persist();return json(res,200,{error:0});
 }
 if(url.searchParams.get('access')!==access)return json(res,403,{});
 if(url.pathname==='/state')return json(res,200,{revision,locked,events,versions});
 if(url.pathname==='/lock'){locked=true;await persist();return json(res,200,{locked});}
 if(url.pathname==='/forcesave'){
 const command={c:'forcesave',key};const r=await fetch('http://127.0.0.1:18088/coauthoring/CommandService.ashx',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...command,token:sign(command)})});return json(res,r.status,await r.json());
 }
 if(url.pathname!=='/')return json(res,404,{});
 const config={documentType:'word',width:'100%',height:'100%',document:{fileType:'docx',key,title:'P0 synthetic fixture.docx',url:`http://host.docker.internal:18089/source.docx?token=${source}`,permissions:{edit:true,download:true}},editorConfig:{mode:'edit',lang:'en',callbackUrl:'http://host.docker.internal:18089/callback',user:{id:'p0-reviewer',name:'P0 Tester'},customization:{forcesave:true}}};config.token=sign(config);
 res.setHeader('content-type','text/html');res.end(`<html><body style="margin:0"><div id="editor"></div><script src="http://127.0.0.1:18088/web-apps/apps/api/documents/api.js"></script><script>const config=${JSON.stringify(config)};config.events={onDocumentReady:()=>{window.documentReady=true},onError:e=>{window.editorError=e.data}};window.editor=new DocsAPI.DocEditor('editor',config);</script></body></html>`);
 }catch(e){events.push({error:e.message});await persist();json(res,500,{error:1});}});
server.listen(18089,'0.0.0.0',async()=>{await fs.writeFile(path.join(dir,'browser-session.json'),JSON.stringify({url:`http://127.0.0.1:18089/?access=${access}`,access}),{mode:0o600});console.log('P0 Office harness listening on 18089');});
