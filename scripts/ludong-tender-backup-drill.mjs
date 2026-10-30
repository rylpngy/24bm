import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,openSync,closeSync,copyFileSync,cpSync,readdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkedObjectPath,compareRows} from './recovery-drill.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),runtime=resolve(root,'.ludong-tender-runtime');
const secrets=JSON.parse(readFileSync(resolve(runtime,'secrets.json'))),env={...process.env,...secrets};
const stamp=String(Date.now()),directory=resolve(runtime,'backups',stamp),database=`poc_drill_${stamp}`,bucket=`ludong-poc-drill-${stamp}`;
mkdirSync(directory,{recursive:true,mode:0o700});
const sha=b=>createHash('sha256').update(b).digest('hex');
function run(command,args,options={}){const r=spawnSync(command,args,{env,cwd:root,maxBuffer:256*1024*1024,...options});if(r.status!==0)throw new Error(`${command} failed; inspect isolated logs, original targets were not selected`);return r.stdout;}
const compose=['compose','-f',resolve(root,'infra/ludong-tender-poc/compose.yml')];
const pg=run('docker',[...compose,'ps','-q','postgres'],{encoding:'utf8'}).trim();
const minio=run('docker',[...compose,'ps','-q','minio'],{encoding:'utf8'}).trim();assert.ok(pg&&minio);
function sql(db,query){return run('docker',['exec','-i',pg,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','ludong_poc','-d',db],{input:query,encoding:'utf8'}).trim();}
const quote=s=>'"'+s.replaceAll('"','""')+'"',literal=s=>"'"+s.replaceAll("'","''")+"'",shell=s=>"'"+s.replaceAll("'","'\\''")+"'";
function fingerprints(db,tables){return JSON.parse(sql(db,'select json_agg(t) from ('+tables.map(t=>`select ${literal(t)} name,count(*)::int rows,md5(coalesce(string_agg(md5(row_to_json(r)::text),'' order by md5(row_to_json(r)::text)),'')) digest from public.${quote(t)} r`).join(' union all ')+') t'));}
function mc(command,input){return run('docker',['exec','-i',minio,'sh','-c','export MC_HOST_poc="http://${MINIO_ROOT_USER}:${MINIO_ROOT_PASSWORD}@127.0.0.1:9000"; '+command],{input});}
const state=JSON.parse(readFileSync(resolve(runtime,'backend.json'))),jar=state.args.at(-1);
assert.ok(jar.startsWith(resolve(runtime,'releases')+'/'));
assert.equal(sha(readFileSync(jar)),sha(readFileSync(resolve(root,'backend-java/target/procurement-saas-backend-0.1.0-SNAPSHOT.jar'))),'Build differs from running POC');
const actual=run('ps',['-p',String(state.pid),'-o','command='],{encoding:'utf8'});assert.ok(actual.includes(jar));
const buildEnv={...env,VITE_SELF_LOGIN:'true',VITE_KEYCLOAK_ENABLED:'false',VITE_KEYCLOAK_URL:'',VITE_JAVA_API_BASE_URL:'',VITE_PORTAL_URL:'http://127.0.0.1:5288/?solution=ludong-poc',DEV_API_PROXY_TARGET:'http://127.0.0.1:8098'};
for(const [name,app] of [['buyer','tenant-portal'],['supplier','supplier-portal']]){run('pnpm',['--filter',`@24bid/${app}`,'build'],{env:buildEnv});cpSync(resolve(root,'apps',app,'dist'),resolve(directory,name),{recursive:true});}
const report={passed:false,directory,database,bucket,scope:'Local isolated recovery only; not production RTO/RPO',checks:[]};
let child,log,stopped=false;
try{
  // Quiesce only the recorded POC writer so database and object originals share a stable backup boundary.
  process.kill(state.pid,'SIGTERM');stopped=true;
  for(let i=0;i<60;i++){try{process.kill(state.pid,0);}catch{break;}await new Promise(r=>setTimeout(r,500));}
  assert.equal(spawnSync('lsof',['-tiTCP:8098','-sTCP:LISTEN']).status,1,'POC writer still active');
  const tables=JSON.parse(sql('ludong_tender_poc',"select json_agg(tablename order by tablename) from pg_tables where schemaname='public'"));
  const before=fingerprints('ludong_tender_poc',tables);
  const dump=run('docker',['exec',pg,'pg_dump','-Fc','-U','ludong_poc','ludong_tender_poc']);
  writeFileSync(resolve(directory,'database.dump'),dump,{mode:0o600});
  const objects=mc('mc ls --recursive --json poc/ludong-tender-attachments').toString().trim().split('\n').filter(Boolean).map(JSON.parse).filter(o=>o.type==='file');
  const originals=[];
  for(const object of objects){const key=checkedObjectPath(object.key),bytes=mc('mc cat '+shell('poc/ludong-tender-attachments/'+key)),path=resolve(directory,'attachments',key);mkdirSync(dirname(path),{recursive:true,mode:0o700});writeFileSync(path,bytes,{mode:0o600});originals.push({key,size:bytes.length,sha256:sha(bytes)});}
  writeFileSync(resolve(directory,'inventory.json'),JSON.stringify({tables,rows:before,objects:originals,dumpSha256:sha(dump)},null,2),{mode:0o600});
  copyFileSync(jar,resolve(directory,'backend.jar'));
  report.checks.push('database and object originals backed up; Java and both built portals frozen');
  run('node',['scripts/ludong-tender-environment.mjs','restart-backend']);stopped=false;
  // New destinations only. createdb/mb fail on collisions; no drop, clean, repair or overwrite.
  run('docker',['exec',pg,'createdb','-U','ludong_poc',database]);
  run('docker',['exec','-i',pg,'pg_restore','--exit-on-error','--no-owner','--no-acl','-U','ludong_poc','-d',database],{input:dump});
  compareRows(before,fingerprints(database,tables));report.checks.push('all database table fingerprints matched');
  mc('mc mb '+shell('poc/'+bucket));
  for(const o of originals){const bytes=readFileSync(resolve(directory,'attachments',o.key));mc('mc pipe '+shell(`poc/${bucket}/${o.key}`),bytes);assert.equal(sha(mc('mc cat '+shell(`poc/${bucket}/${o.key}`))),o.sha256);}
  report.checks.push(`${originals.length} object originals restored and SHA256 matched`);
  assert.equal(spawnSync('lsof',['-tiTCP:8198','-sTCP:LISTEN']).status,1,'Clone port occupied');
  log=openSync(resolve(directory,'clone.log'),'wx',0o600);
  const cloneEnv={PATH:process.env.PATH,HOME:process.env.HOME,JAVA_HOME:'/opt/homebrew/opt/openjdk@21',SERVER_ADDRESS:'127.0.0.1',SERVER_PORT:'8198',
    DB_URL:`jdbc:postgresql://127.0.0.1:26432/${database}`,DB_USERNAME:'ludong_poc',DB_PASSWORD:secrets.POC_DB_PASSWORD,JWT_SECRET:secrets.JWT_SECRET,
    MINIO_ENDPOINT:'http://127.0.0.1:29000',MINIO_ACCESS_KEY:'ludong-tender-poc',MINIO_SECRET_KEY:secrets.POC_STORAGE_PASSWORD,MINIO_BUCKET:bucket,
    SELF_LOGIN_ENABLED:'true',KEYCLOAK_ENABLED:'false',APP_SEED_LOCATIONS:'',APP_WORKFLOW_DEADLINES_ENABLED:'false',APP_RFQ_QUOTATION_EXTENSIONS_ENABLED:'false',CONTRACT_REVIEW_MODEL_ENABLED:'false'};
  child=spawn('/opt/homebrew/opt/openjdk@21/bin/java',['-Xmx512m','-jar',resolve(directory,'backend.jar')],{env:cloneEnv,stdio:['ignore',log,log]});
  let healthy=false;for(let i=0;i<120;i++){if(child.exitCode!==null)throw new Error('Restored POC exited; inspect clone.log');try{if((await fetch('http://127.0.0.1:8198/api/v1/health')).ok){healthy=true;break;}}catch{}await new Promise(r=>setTimeout(r,1000));}assert.ok(healthy);
  const response=await fetch('http://127.0.0.1:8198/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account:'LDU000001',password:'demo123456',scope:'BUYER',tenantId:'tenant-ludong-poc'})});assert.ok(response.ok);const token=(await response.json()).data.accessToken;
  for(const endpoint of ['ludong-poc/applications','rfqs','contracts']){const r=await fetch('http://127.0.0.1:8198/api/v1/buyer/'+endpoint,{headers:{Authorization:`Bearer ${token}`}});assert.ok(r.ok,endpoint);}
  const final=JSON.parse(readFileSync(resolve(runtime,'final-acceptance/result.json')));
  for(const material of final.materials){const r=await fetch(`http://127.0.0.1:8198/api/v1/buyer/attachments/${material.id}/download`,{headers:{Authorization:`Bearer ${token}`}});assert.ok(r.ok);assert.equal(sha(Buffer.from(await r.arrayBuffer())),material.sha256);}
  report.checks.push('restored API healthy; authenticated business lists and three original attachment downloads passed');
  report.jarSha256=sha(readFileSync(jar));report.dumpSha256=sha(dump);report.tableCount=tables.length;report.objectCount=originals.length;report.sourceCommit=run('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();report.passed=true;
  report.sourceDirty=Boolean(run('git',['status','--porcelain'],{encoding:'utf8'}).trim());
  const artifacts=[];
  function inventory(path){for(const e of readdirSync(resolve(directory,path),{withFileTypes:true})){const name=path+'/'+e.name;if(e.isDirectory())inventory(name);else artifacts.push({path:name,sha256:sha(readFileSync(resolve(directory,name)))});}}
  inventory('buyer');inventory('supplier');
  artifacts.push({path:'backend.jar',sha256:report.jarSha256},{path:'database.dump',sha256:report.dumpSha256});
  writeFileSync(resolve(directory,'artifacts.json'),JSON.stringify(artifacts,null,2),{mode:0o600});
}finally{
  if(child&&child.exitCode===null){child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));}if(log!==undefined)closeSync(log);
  if(stopped)run('node',['scripts/ludong-tender-environment.mjs','restart-backend']);
  report.finishedAt=new Date().toISOString();writeFileSync(resolve(directory,'result.json'),JSON.stringify(report,null,2),{mode:0o600});
}
console.log(`PASS: ${report.tableCount} tables, ${report.objectCount} originals; retained isolated recovery ${database}. Backup: ${directory}`);
