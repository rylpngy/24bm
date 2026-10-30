import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),base='http://127.0.0.1:8098';
const requests=[];
async function api(path,token,method='GET',body,expected=200){
  const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  const j=await r.json();assert.equal(r.status,expected,`${method} ${path}: ${j.message}`);requests.push({path,method,status:r.status});return j.data;
}
async function buyer(account='LDU000001'){return(await api('/api/v1/auth/login',null,'POST',{account,password:'demo123456',scope:'BUYER',tenantId:'tenant-ludong-poc'})).accessToken;}
const admin=await buyer();const readOnly=await buyer('LDU200003');
const suppliers=[];
for(const letter of ['a','b','c']){
  const supplierId=`ent-ldu-demo-${letter}`;
  const token=(await api('/api/v1/auth/login',null,'POST',{account:`ldu.supplier.${letter}@example.com`,password:'demo123456',scope:'SUPPLIER',supplierId})).accessToken;
  const qualifications=await api('/api/v1/supplier/qualifications',token);
  if(!qualifications.some(q=>q.status==='active')){
    const fileName=`POC合成测试资质-${letter}.txt`;
    const ticket=await api('/api/v1/supplier/qualifications/upload-ticket',token,'POST',{fileName});
    const url=new URL(ticket.uploadUrl,base);assert.equal(url.origin,base);url.searchParams.set('contentType','text/plain');
    assert.equal((await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/octet-stream'},body:Buffer.from('本文件仅用于隔离POC系统验收，不是真实营业执照或资质。')})).status,200);
    await api('/api/v1/supplier/qualifications',token,'POST',{qualificationType:'POC合成验收资料（非真实资质）',certificateNo:`POC-${letter}`,expiresAt:'2028-12-31',fileName,storageKey:ticket.storageKey},201);
  }
  suppliers.push({id:supplierId,token});
}
const rfq=await api('/api/v1/buyer/rfqs',admin,'POST',{title:'鲁东大学教学终端与实验采集设备询比（合成验收）',
  invitedSupplierIds:suppliers.map(s=>s.id),deadlineAt:new Date(Date.now()+86400000).toISOString(),method:'询比',saveAsDraft:true,
  quoteRequirement:'分项含税报价，品牌型号、技术响应和原始报价附件；合成验收项目。',deliveryRequirement:'30天内到货并安装',evaluationMethod:'综合评审',
  directItems:[{materialId:'mat-ldu-teaching-terminal',quantity:3},{materialId:'mat-ldu-lab-instrument',quantity:2}],directDepartmentId:'dept-ldu-physics',directBudget:200000},201);
const path=`/api/v1/buyer/rfqs/${rfq.id}`,supplierPath=`/api/v1/supplier/rfqs/${rfq.id}`;
const policy={fullQuoteRequired:true,autoExtend:true,extensionHours:24,maxAutoExtensions:1};
await api(path+'/quotation-policy',admin,'PUT',policy);
await api(path+'/quotation-policy',readOnly,'PUT',policy,403);
await api(path+'/publish',admin,'POST');
const current=(await api('/api/v1/supplier/rfqs',suppliers[0].token)).find(x=>x.id===rfq.id);
assert.equal(current.items.length,2);
const fileIds=[],content=Buffer.from('报价原件：两类设备，型号、数量与技术响应请以系统逐项报价为准。合成演示资料。');
for(const s of suppliers){
  const upload=await fetch(base+supplierPath+`/quotation-files?fileName=${encodeURIComponent('报价原件-'+s.id+'.txt')}`,{method:'POST',headers:{Authorization:`Bearer ${s.token}`,'Content-Type':'application/octet-stream'},body:content});
  assert.equal(upload.status,200);fileIds.push((await upload.json()).data.id);
}
if(process.argv.includes('--prepare-ui')){
  const out=resolve(root,'.ludong-tender-runtime/quotation-acceptance');mkdirSync(out,{recursive:true});
  writeFileSync(resolve(out,'浏览器合成报价原件.txt'),content);
  writeFileSync(resolve(out,'ui-fixture.json'),JSON.stringify({rfqId:rfq.id},null,2));
  console.log(`UI fixture ready, no quotes submitted: ${rfq.id}`);
  process.exit(0);
}
const makeQuote=(supplier,revision=1)=>({
  amount:999,taxRate:supplier===1?0:13,deliveryDays:20+supplier,
  lineItems:current.items.map((item,index)=>({description:item.materialName,unit:item.unit,quantity:item.quantity,
    unitPrice:(item.materialId==='mat-ldu-teaching-terminal'?6000:80000)+supplier*100+revision*10,demandItemId:item.demandItemId})),
  details:{invoiceType:'增值税专用发票',remark:`供应商${supplier+1} 第${revision}版合成报价`,attachmentIds:[fileIds[supplier]],
    lines:current.items.map((item,index)=>({demandItemId:item.demandItemId,brand:`演示品牌${supplier+1}`,model:`POC-${index+1}-V${revision}`,
      technicalParameters:item.materialId==='mat-ldu-teaching-terminal'?'国产处理器，16GB内存，512GB固态硬盘，23.8英寸显示器':'8通道同步采集；支持开放数据接口',
      technicalResponse:supplier===2?'存在偏离：接口适配需另行确认':'满足采购参数，无负偏离',remark:'仅用于POC验收'}))},
});
const incomplete=makeQuote(0);incomplete.details.lines[0].model='';
await api(supplierPath+'/quotes',suppliers[0].token,'POST',incomplete,400);
const forged=makeQuote(0);forged.details.attachmentIds=[fileIds[1]];
await api(supplierPath+'/quotes',suppliers[0].token,'POST',forged,403);
const created=await api(supplierPath+'/quotes',suppliers[0].token,'POST',makeQuote(0),201);
assert.notEqual(created.amount,999);
await api(`/api/v1/supplier/quotes/${created.id}`,suppliers[0].token,'PUT',{...makeQuote(0,2),expectedVersion:1});
await api(`/api/v1/supplier/quotes/${created.id}`,suppliers[0].token,'PUT',{...makeQuote(0,3),expectedVersion:1},400);
const own=await api(supplierPath+'/quotation-package',suppliers[0].token);
assert.deepEqual(own.versions.map(v=>v.versionNo),[1,2]);
assert.equal(own.versions[0].snapshot.details.lines[0].model,'POC-1-V1');
assert.equal(own.versions[1].snapshot.details.lines[0].model,'POC-1-V2');
const second=await api(supplierPath+'/quotation-package',suppliers[1].token);assert.equal(second.versions.length,0);
assert.equal((await fetch(base+supplierPath+`/quotation-files/${fileIds[0]}`,{headers:{Authorization:`Bearer ${suppliers[1].token}`}})).status,403);
const sealed=await api(path+'/quotation-package',admin);assert.equal(sealed.validQuoteCount,1);assert.equal(sealed.versions.length,0);
await api(path,admin,'PUT',{title:rfq.title,deadlineAt:new Date(Date.now()+172800000).toISOString(),quoteRequirement:'试图绕过正式延期入口',deliveryRequirement:'30天',evaluationMethod:'综合评审'},400);
const buyerRfq=(await api('/api/v1/buyer/rfqs',admin)).find(x=>x.id===rfq.id);assert.equal(buyerRfq.quotes.length,0);
assert.equal((await fetch(base+path+'/technical-comparison.xlsx',{headers:{Authorization:`Bearer ${admin}`}})).status,400);
assert.equal((await fetch(base+path+`/quotation-files/${fileIds[0]}`,{headers:{Authorization:`Bearer ${admin}`}})).status,403);
await api(path+'/open',admin,'POST',{force:true},400);
const secrets=JSON.parse(readFileSync(resolve(root,'.ludong-tender-runtime/secrets.json'),'utf8'));
function expire(){assert.match(rfq.id,/^[A-Za-z0-9_-]+$/);const r=spawnSync('docker',['compose','-f',resolve(root,'infra/ludong-tender-poc/compose.yml'),'exec','-T','postgres','psql','-U','ludong_poc','-d','ludong_tender_poc','-v','ON_ERROR_STOP=1','-c',`update rfqs set deadline_at=now()-interval '1 second' where tenant_id='tenant-ludong-poc' and id='${rfq.id}';`],{env:{...process.env,...secrets},encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/UPDATE 1/);}
// Only the synthetic RFQ created above is backdated in the fixed isolated DB, never the host clock or old projects.
expire();
await api(supplierPath+'/quotes',suppliers[1].token,'POST',makeQuote(1),400);
const until=Date.now()+40000;let extended;
do{extended=await api(path+'/quotation-package',admin);if(extended.extensions.length)break;await new Promise(r=>setTimeout(r,1500));}while(Date.now()<until);
assert.equal(extended.extensions.length,1);assert.equal(extended.extensions[0].mode,'automatic');assert.equal(extended.extensions[0].validQuoteCount,1);
await new Promise(r=>setTimeout(r,11000));assert.equal((await api(path+'/quotation-package',admin)).extensions.length,1);
expire();await new Promise(r=>setTimeout(r,11000));
const maxed=await api(path+'/quotation-package',admin);assert.equal(maxed.extensions.length,1,'Automatic extension limit is per round');
const manual={expectedDeadline:maxed.deadlineAt,newDeadline:new Date(Date.now()+86400000).toISOString(),reason:'有效报价不足三家，人工延长征集时间（合成验收）'};
await api(path+'/extend-quotation',admin,'POST',manual);await api(path+'/extend-quotation',admin,'POST',manual);
assert.equal((await api(path+'/quotation-package',admin)).extensions.length,2,'Repeated manual submission is idempotent');
await api(path+'/extend-quotation',admin,'POST',{...manual,newDeadline:new Date(Date.now()+172800000).toISOString()},400);
for(let index=1;index<3;index++)await api(supplierPath+'/quotes',suppliers[index].token,'POST',makeQuote(index),201);
const three=await api(path+'/quotation-package',admin);assert.equal(three.validQuoteCount,3);
await api(path+'/extend-quotation',admin,'POST',{expectedDeadline:three.deadlineAt,newDeadline:new Date(Date.now()+172800000).toISOString(),reason:'不应再按不足三家规则延期'},400);
await api(path+'/open',admin,'POST',{force:true});
await api(`/api/v1/supplier/quotes/${created.id}`,suppliers[0].token,'PUT',{...makeQuote(0,3),expectedVersion:2},400);
const opened=await api(path+'/quotation-package',admin);assert.equal(opened.versions.length,4);
assert.equal(opened.files.length,3);assert.equal(opened.sealed,false);
const downloaded=await fetch(base+path+`/quotation-files/${fileIds[0]}`,{headers:{Authorization:`Bearer ${admin}`}});assert.equal(downloaded.status,200);assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()),content);
assert.equal((await api(supplierPath+'/quotation-package',suppliers[1].token)).versions.length,1);
const book=await fetch(base+path+'/technical-comparison.xlsx',{headers:{Authorization:`Bearer ${admin}`}});assert.equal(book.status,200);
const out=resolve(root,'.ludong-tender-runtime/quotation-acceptance');mkdirSync(out,{recursive:true});const file=resolve(out,'技术比价及报价版本.xlsx');writeFileSync(file,Buffer.from(await book.arrayBuffer()));
const check=spawnSync('python3',['-c','import sys,zipfile,xml.etree.ElementTree as E; z=zipfile.ZipFile(sys.argv[1]); ns={"m":"http://schemas.openxmlformats.org/spreadsheetml/2006/main"}; w=E.fromstring(z.read("xl/workbook.xml")); assert len(w.findall("m:sheets/m:sheet",ns))==4; s=z.read("xl/sharedStrings.xml").decode(); assert "POC-1-V2" in s and "存在偏离" in s and "SHA256" in s; print("PASS: four workbook sheets, current technical response, deviation and attachment hashes")',file],{encoding:'utf8'});
assert.equal(check.status,0,check.stderr);
writeFileSync(resolve(out,'result.json'),JSON.stringify({result:'PASS',at:new Date().toISOString(),rfqId:rfq.id,quoteId:created.id,requests,checks:['Full line quote and immutable versions','Stale update and foreign file rejection','Sealed buyer package','Deadline lock','Automatic and manual extensions with quota and idempotency','Three-supplier comparison','Actual attachment and four-sheet XLSX']},null,2));
console.log(`PASS: ${requests.length} HTTP requests; two-sided quotation, versions, deadline/extension boundaries and actual XLSX/attachment download. RFQ ${rfq.id}`);
