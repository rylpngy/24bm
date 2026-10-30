import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),base='http://127.0.0.1:8098',prefix='/api/v1/buyer/contract-review';
const out=resolve(root,'.ludong-tender-runtime/contract-review-acceptance');mkdirSync(out,{recursive:true});
const requests=[];
async function api(path,token,method='GET',body,expected=200){
  const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(85000)});
  const json=await response.json();assert.equal(response.status,expected,`${method} ${path}: ${json.message}`);requests.push({path,method,status:response.status});return json.data;
}
const login=async(account='LDU000001')=>(await api('/api/v1/auth/login',null,'POST',{account,password:'demo123456',scope:'BUYER',tenantId:'tenant-ludong-poc'})).accessToken;
const token=await login(),readOnly=await login('LDU200003');
const supplier=(await api('/api/v1/auth/login',null,'POST',{account:'ldu.supplier.a@example.com',password:'demo123456',scope:'SUPPLIER',supplierId:'ent-ldu-demo-a'})).accessToken;
const rule=(id,type,perspective,keywords,basis,suggestion)=>({id,title:id,type,perspective,severity:'HIGH',matchMode:'ALL',keywords,
  sourceName:'合成POC内部审查规则（非学校正式制度）',clause:`演示条款-${id}`,basis,suggestion});
const rules=[rule('prepayment','KEYWORD','BUYER',['预付','100%'],'复核全额预付的履约保障。','付款：分阶段支付，验收合格后支付尾款，具体比例由双方确认。'),
  rule('payment_delay','KEYWORD','SELLER',['验收','180日'],'复核回款期限及触发条件是否合理。','付款：验收合格并收到有效发票后30日内支付剩余款项。'),
  rule('confidentiality','MISSING','BOTH',['保密'],'双方应明确保密范围与责任。','保密：双方对履约中获悉的非公开资料承担保密义务，法律规定的披露除外。'),
  rule('balanced_obligations','SEMANTIC','BOTH',[],'按指定甲乙方视角，复核单方变更、无限期验收及免责条款；不判断违法。','任何重大变更及免责事项须经双方书面确认。')];
const draft=await api(prefix+'/rule-sets',token,'POST',{name:'鲁东合同审查合成验收规则',expectedRevision:0,rules});
await api(prefix+'/rule-sets',readOnly,'POST',{name:'不得创建',expectedRevision:0,rules},403);
await api(prefix+'/rule-sets',token,'POST',{name:'重复规则应拒绝',expectedRevision:0,rules:[rules[0],rules[0]]},400);
const v1=await api(prefix+`/rule-sets/${draft.id}/publish`,token,'POST',{expectedRevision:1});
await api(prefix+`/rule-sets/${draft.id}`,token,'PUT',{name:draft.name,expectedRevision:0,rules},400);
const changed=structuredClone(rules);changed[0].keywords=['全额无保障'];
const saved=await api(prefix+`/rule-sets/${draft.id}`,token,'PUT',{name:draft.name,expectedRevision:1,rules:changed});
const v2=await api(prefix+`/rule-sets/${draft.id}/publish`,token,'POST',{expectedRevision:saved.revision});
assert.equal(v2.version,2);assert.deepEqual((await api(prefix+'/rule-versions',token)).find(v=>v.id===v1.id).rules[0].keywords,['预付','100%']);
await api(prefix+`/rule-sets/${draft.id}/publish`,token,'POST',{expectedRevision:1},400);
const content=Buffer.from('鲁东大学设备采购合同（合成验收，非正式合同）\n第一条 采购标的：教学办公终端3台、实验数据采集仪2套。\n第二条 付款：甲方须预付100%合同价款，不要求乙方提供任何履约保障。\n第三条 尾款：验收合格后180日内支付剩余款项。\n第四条 乙方可以不经甲方同意将全部设备更换为任意品牌型号，且不承担任何责任。\n第五条 甲方可以无限期不组织验收，并因此无限期不支付货款，乙方无权提出异议。\n第六条 交付：乙方应在合同生效后30日内完成安装。');
writeFileSync(resolve(out,'合成采购合同.txt'),content);
async function upload(name,bytes,expected=200){const response=await fetch(base+prefix+`/documents?fileName=${encodeURIComponent(name)}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/octet-stream'},body:bytes});const json=await response.json();assert.equal(response.status,expected,json.message);requests.push({path:prefix+'/documents',method:'POST',status:response.status});return json.data;}
await upload('扫描合同.pdf',Buffer.from('not a text contract'),400);await upload('损坏合同.docx',Buffer.from('not a zip'),400);
const doc=await upload('合成采购合同.txt',content);
await api(prefix+`/documents/${doc.id}`,readOnly,'GET',undefined,403);
await api(prefix+`/documents/${doc.id}`,supplier,'GET',undefined,403);
await api(prefix+'/documents/nonexistent-id',token,'GET',undefined,403);
assert.ok((await api(prefix+'/documents?page=1&pageSize=1',token)).items.length===1);
const review=(version,perspective='BUYER',textVersion=1,useModel=false)=>api(prefix+`/documents/${doc.id}/reviews`,token,'POST',{rulesVersionId:version,perspective,expectedVersion:textVersion,useModel});
const buyer=await review(v1.id),seller=await review(v1.id,'SELLER'),updatedRules=await review(v2.id);
assert.deepEqual(new Set(buyer.findings.map(f=>f.ruleId)),new Set(['prepayment','confidentiality']));
assert.deepEqual(new Set(seller.findings.map(f=>f.ruleId)),new Set(['payment_delay','confidentiality']));
assert.deepEqual(updatedRules.findings.map(f=>f.ruleId),['confidentiality']);
assert.equal(buyer.mode,'RULE_ONLY');
const original=(await api(prefix+`/documents/${doc.id}`,token)).versions[0];
for(const finding of buyer.findings)if(finding.locator)assert.ok(original.segments.find(s=>s.locator===finding.locator).text.includes(finding.quote));
await api(prefix+`/documents/${doc.id}/reviews`,token,'POST',{rulesVersionId:v1.id,perspective:'UNSUPPORTED',expectedVersion:1,useModel:false},400);
await api(prefix+`/documents/${doc.id}/reviews`,token,'POST',{rulesVersionId:'foreign-version',perspective:'BUYER',expectedVersion:1,useModel:false},400);
let modelRuns=[];
if(process.argv.includes('--model')){
  modelRuns=[await review(v1.id,'BUYER',1,true),await review(v1.id,'SELLER',1,true)];
  for(const run of modelRuns){assert.equal(run.mode,'MODEL_ASSISTED',run.limitation);assert.ok(run.model);for(const finding of run.findings.filter(f=>f.origin==='MODEL')){
    assert.ok(original.segments.find(s=>s.locator===finding.locator)?.text.includes(finding.quote));assert.ok(rules.some(r=>r.id===finding.ruleId&&r.type==='SEMANTIC'));}}
  assert.ok(modelRuns.some(run=>run.findings.some(f=>f.origin==='MODEL')),'Real model must produce at least one grounded semantic finding for this fixture');
}
const hit=buyer.findings.find(f=>f.ruleId==='prepayment');
const action={findingId:hit.id,action:'adopt',expectedVersion:1,replacement:hit.suggestion,comment:'验收人员确认分阶段付款，替换合成风险段落。'};
const decision=await api(prefix+`/documents/${doc.id}/reviews/${buyer.id}/decisions`,token,'POST',action);
assert.equal(decision.newVersion,2);assert.ok(decision.actorId);assert.ok(decision.actorName);
assert.equal((await api(prefix+`/documents/${doc.id}/reviews/${buyer.id}/decisions`,token,'POST',action)).id,decision.id);
await api(prefix+`/documents/${doc.id}/reviews/${buyer.id}/decisions`,token,'POST',{...action,comment:'冲突操作'},400);
await api(prefix+`/documents/${doc.id}/reviews/${buyer.id}/decisions`,token,'POST',{...action,findingId:buyer.findings.find(f=>!f.locator).id,expectedVersion:2},400);
const second=await review(v2.id,'BUYER',2),missing=second.findings.find(f=>f.ruleId==='confidentiality');
await api(prefix+`/documents/${doc.id}/reviews/${second.id}/decisions`,token,'POST',{findingId:missing.id,action:'dismiss',expectedVersion:2,comment:'合成验收：先保留补充材料处理记录。'});
const third=await review(v2.id,'BUYER',2),add=third.findings.find(f=>f.ruleId==='confidentiality');
await api(prefix+`/documents/${doc.id}/reviews/${third.id}/decisions`,token,'POST',{findingId:add.id,action:'adopt',expectedVersion:2,replacement:add.suggestion,comment:'合成验收：确认新增保密条款。'});
const final=await api(prefix+`/documents/${doc.id}`,token);
assert.equal(final.document.currentVersion,3);assert.equal(final.versions.length,3);assert.equal(final.decisions.length,3);
assert.ok(final.versions.find(v=>v.version===1).segments.some(s=>s.text.includes('预付100%')));
assert.ok(final.versions.find(v=>v.version===3).segments.some(s=>s.text===hit.suggestion));
assert.ok(final.versions.find(v=>v.version===3).segments.some(s=>s.text===add.suggestion));
const audits=await api('/api/v1/buyer/audit-logs?targetType=contract_review_document&limit=200',token);
const decisions=audits.filter(a=>a.targetId===doc.id&&a.action==='CONTRACT_REVIEW_HUMAN_DECISION');
assert.equal(decisions.length,3,'Duplicate adoption must not duplicate audit events');assert.ok(decisions.every(a=>a.actorId===decision.actorId));
const originalDownload=await fetch(base+prefix+`/documents/${doc.id}/original`,{headers:{Authorization:`Bearer ${token}`}});assert.equal(originalDownload.status,200);assert.deepEqual(Buffer.from(await originalDownload.arrayBuffer()),content);
const word=await fetch(base+prefix+`/documents/${doc.id}/versions/3/export`,{headers:{Authorization:`Bearer ${token}`}});assert.equal(word.status,200);const file=resolve(out,'合同审查校对稿-V3.docx');writeFileSync(file,Buffer.from(await word.arrayBuffer()));
const check=spawnSync('python3',['-c','import sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); s=z.read("word/document.xml").decode(); assert "分阶段支付" in s and "保密" in s and "非签署正本" in s and "预付100%" not in s; print("PASS: revised DOCX contains human-confirmed changes")',file],{encoding:'utf8'});assert.equal(check.status,0,check.stderr);
const docxFile=resolve(out,'浏览器合同样本.docx');
const fixture=spawnSync('python3',['-c',`import sys,zipfile,html
t=open(sys.argv[1],encoding='utf-8').read()
with zipfile.ZipFile(sys.argv[2],'w',zipfile.ZIP_DEFLATED) as z:
 z.writestr('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
 z.writestr('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
 z.writestr('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+''.join('<w:p><w:r><w:t>'+html.escape(line)+'</w:t></w:r></w:p>' for line in t.splitlines())+'</w:body></w:document>')`,resolve(out,'合成采购合同.txt'),docxFile],{encoding:'utf8'});assert.equal(fixture.status,0,fixture.stderr);
const wordDoc=await upload('浏览器合同样本.docx',readFileSync(docxFile));const wordRun=await api(prefix+`/documents/${wordDoc.id}/reviews`,token,'POST',{rulesVersionId:v1.id,perspective:'BUYER',expectedVersion:1,useModel:false});assert.ok(wordRun.findings.some(f=>f.locator?.startsWith('paragraph:')));
writeFileSync(resolve(out,'result.json'),JSON.stringify({result:'PASS',at:new Date().toISOString(),documentId:doc.id,browserDocumentId:wordDoc.id,ruleSetId:draft.id,v1:v1.id,v2:v2.id,requests,
  modelRuns:modelRuns.map(r=>({id:r.id,perspective:r.perspective,model:r.model,mode:r.mode,semanticFindings:r.findings.filter(f=>f.origin==='MODEL').length})),checks:['Immutable published rules','Perspective and rule changes actually affect results','Original evidence and DOCX locator','Human adoption/dismissal and stale review guard','Immutable original bytes and revision history','Actual revised DOCX download']},null,2));
console.log(`PASS: ${requests.length} HTTP requests; ${modelRuns.length} real model reviews; rules, versions, perspectives, human history and actual files. Browser document: ${wordDoc.id}`);
