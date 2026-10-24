import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
const base=process.env.JAVA_API_BASE_URL;
assert.equal(base,'http://127.0.0.1:8095');assert.equal(process.env.ACCEPTANCE_LOCAL_WRITES,'1');
const database=process.env.ACCEPTANCE_EXPECTED_DB;assert.match(database??'',/^identity_readiness_\d+$/);
const pid=execFileSync('lsof',['-tiTCP:8095','-sTCP:LISTEN'],{encoding:'utf8'}).trim();assert.match(pid,/^\d+$/);
const command=execFileSync('ps',['eww','-p',pid,'-o','command='],{encoding:'utf8'});
assert.ok(command.includes(`DB_URL=jdbc:postgresql://127.0.0.1:25432/${database} `));assert.ok(!/SPRING_APPLICATION_JSON=|SPRING_DATASOURCE_URL=|--spring\.|-Dspring\./.test(command));
const password=process.env.ACCEPTANCE_PASSWORD;assert.ok(password);
const runId='identity-'+Date.now(),report={passed:false,database,tenantId:runId,account:runId+'@example.com',records:{},checks:[]};
async function api(path,token,data,expected=200,method=data===undefined?'GET':'POST'){
  const r=await fetch(base+'/api/v1/'+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(20000)});
  const j=await r.json();assert.ok((expected===200||expected===201?[200,201]:[expected]).includes(r.status),`${method} ${path}: ${r.status} ${j.message}`);return j.data;
}
const login=(account,scope='BUYER',tenantId=runId)=>api('auth/login',null,{account,password,scope,...(scope==='BUYER'?{tenantId}:{})});
const check=x=>{report.checks.push(x);console.log('PASS '+x);};
async function externalLogin(){
  const r=await fetch('http://localhost:8081/realms/24bid/protocol/openid-connect/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'password',client_id:'24bid-portal',username:'buyer.owner@example.com',password})});
  assert.equal(r.status,200);const j=await r.json();const claims=JSON.parse(Buffer.from(j.access_token.split('.')[1],'base64url'));return{token:j.access_token,subject:claims.sub};
}
try{
  const p=(await login('platform.admin@example.com','PLATFORM')).accessToken;
  await api('platform/tenants',p,{tenantId:runId,enterpriseId:'ent-'+runId,name:'统一身份验收 '+runId,industry:'通用采购',plan:'MVP',userLimit:20,enabledFeatures:['rfq','order','finance'],adminName:'身份管理员',adminEmail:report.account,adminPassword:password},201);
  const session=await login(report.account),b=session.accessToken;report.buyerId=session.userId;
  const department=await api('buyer/departments',b,{name:'身份接入部'},201);
  const roles=await api('buyer/roles',b),owner=roles.find(r=>r.permissions.includes('buyer:*'));assert.ok(owner);
  const reader=await api('buyer/roles',b,{name:'采购只读',permissions:['buyer:supplier:read'],dataScope:'all'},201);
  const ids=[];for(const [i,role]of [[1,reader.id],[2,owner.id]]){
    const email=`member${i}-${runId}@example.com`;const u=await api('buyer/users',b,{name:'接入成员'+i,email,employeeNo:runId+'-'+i,departmentId:department.id,roleId:role,status:'active',initialPassword:password},201);ids.push(u.id);
  }report.records.members=ids;
  const readiness=await api('buyer/identity-bindings/readiness',b);assert.equal(readiness.issuerConfigured,true);assert.equal(readiness.strictMapping,false);check('configuration state is explicit, not a customer SSO completion claim');
  let ext=await externalLogin();const binding=await api('buyer/identity-bindings',b,{userId:ids[0],subject:ext.subject,reason:'已核对工号及本地成员'});report.records.bindingId=binding.id;ext=await externalLogin();
  await api('buyer/identity-bindings',b,{userId:ids[0],subject:ext.subject,reason:'重复'},400);
  const auth=await api('auth/permissions',ext.token);assert.ok(auth.permissions.includes('buyer:supplier:read'));assert.ok(!auth.permissions.includes('buyer:*'));
  await api('buyer/identity-bindings/readiness',ext.token,undefined,403);check('actual Keycloak token maps to a local member and cannot inherit owner claims');
  let current=await api('buyer/identity-bindings/'+binding.id+'/status',b,{enabled:false,revision:binding.revision,reason:'离岗停用'});
  await api('buyer/suppliers',ext.token,undefined,401);
  current=await api('buyer/identity-bindings/'+binding.id+'/status',b,{enabled:true,revision:current.revision,reason:'重新到岗'});
  await api('buyer/suppliers',ext.token,undefined,401);await new Promise(r=>setTimeout(r,2100));let fresh=await externalLogin();await api('buyer/suppliers',fresh.token);check('disabled mapping immediately rejects and re-enabled mapping requires a fresh signed token');
  await api('buyer/identity-bindings/'+binding.id+'/status',b,{enabled:false,revision:binding.revision,reason:'旧页面'},400);
  current=await api('buyer/identity-bindings/'+binding.id+'/member',b,{userId:ids[1],revision:current.revision,reason:'修正成员对应关系'});
  await api('buyer/suppliers',fresh.token,undefined,401);await new Promise(r=>setTimeout(r,2100));fresh=await externalLogin();await api('buyer/identity-bindings/readiness',fresh.token);check('remap retains the binding, revokes old tokens, and uses the new local roles');
  const list=await api('buyer/identity-bindings?page=1&pageSize=1&keyword='+encodeURIComponent(ext.subject),b);assert.equal(list.total,1);assert.equal(list.items[0].userId,ids[1]);
  const foreign=(await login('buyer.owner@example.com','BUYER','tenant-acme')).accessToken;
  await api('buyer/identity-bindings/'+binding.id+'/status',foreign,{enabled:false,revision:current.revision,reason:'跨企业'},400);
  const audit=await api('buyer/audit-logs',b);assert.ok(audit.some(x=>x.action==='identity.binding_remapped'));check('version conflict, cross-tenant writes, paging/search and audit are enforced');
  report.passed=true;
}finally{writeFileSync(process.env.ACCEPTANCE_REPORT_PATH??'.tmp/identity-http.json',JSON.stringify(report,null,2),{mode:0o600});}
