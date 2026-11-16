import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {baseUrl, requestJson, runLocalSmokeSql, sqlLiteral as sql} from './java-smoke-support.mjs';
import {uploadReceiptVersion} from './agency-material-opening-support.mjs';

assert.equal(baseUrl, 'http://127.0.0.1:18080');
assert.ok(process.env.JAVA_SMOKE_DATABASE_URL?.endsWith('/procurement_agency_p0'));
const existing = JSON.parse(await fs.readFile('.p0/walkthrough.json'));
assert.match(existing.tenantId, /^agency-p2-\d+$/);
const tenant = existing.tenantId;
const organizer = existing.userId;
const reviewerEmail = existing.email.replace('agency-creator-', 'agency-reviewer-');
assert.notEqual(reviewerEmail, existing.email);
const expertPermissions = [
  'buyer:agency:read', 'buyer:agency:document:read', 'buyer:agency:file:read',
  'buyer:agency:evaluation:read', 'buyer:agency:evaluation:confidential', 'buyer:agency:evaluation:review',
];
const experts = [1, 2].map(index => ({
  id: `${tenant}-half-flow-expert-${index}`,
  email: `half-flow-expert-${index}@example.test`,
  name: `半流程走查专家 ${index}`,
}));
runLocalSmokeSql(experts.map(expert => `
  insert into users(id, tenant_id, name, email, status, department_id, password_hash)
  select ${sql(expert.id)},tenant_id,${sql(expert.name)},${sql(expert.email)},'active',department_id,password_hash
  from users where id=${sql(organizer)} and tenant_id=${sql(tenant)}
  on conflict(id) do nothing;
  insert into roles(id, tenant_id, scope, name, permissions, data_scope)
  values(${sql(expert.id+'-role')},${sql(tenant)},'buyer',${sql(expert.name)},${sql(JSON.stringify(expertPermissions))},'self')
  on conflict(id) do nothing;
  insert into user_roles(user_id,role_id) values(${sql(expert.id)},${sql(expert.id+'-role')}) on conflict do nothing;
`).join('\n'));
const accounts = {creator: existing.email, reviewer: reviewerEmail, expert1: experts[0].email, expert2: experts[1].email};
const tokens = {};
for (const [role, account] of Object.entries(accounts)) {
  const res = await requestJson('/api/v1/auth/login', {
    method:'POST', headers:{'content-type':'application/json'},
    body:JSON.stringify({account,password:'demo123456',scope:'BUYER',tenantId:tenant}),
  });
  tokens[role] = res.accessToken;
}
const headers = (role = 'creator') => ({authorization:'Bearer '+tokens[role], 'content-type':'application/json'});
const req = (path,method='GET',body,role='creator') => requestJson(path,{method,headers:headers(role),body:body===undefined?undefined:JSON.stringify(body)});
const call = (path,...args) => req('/api/v1/buyer/agency'+path,...args);
const execution = (path,...args) => call('/execution'+path,...args);
const key = () => crypto.randomUUID();
async function approve(businessId) {
  const tasks = await req('/api/v1/buyer/workflow/tasks','GET',undefined,'reviewer');
  const task = tasks.find(row=>row.businessId===businessId);
  assert.ok(task, '应产生独立审批任务');
  await req(`/api/v1/buyer/workflow/tasks/${task.taskId}/complete`,'POST',
    {action:'approve',comment:'本地半流程合成用例，人工核对通过'},'reviewer');
}
const template = (await call('/packages/'+existing.packageId)).data;
const created = await call('/packages','POST',{
  ...template,title:'半流程电子标评分走查（测试项目）',
  procurementMethod:'公开招标', operatingMode:'half',
  members:experts.map(expert=>({userId:expert.id,role:'VIEWER'})),
});
const pkg = created.record.id;
const packageReview = await call(`/packages/${pkg}/submit`,'POST',{expectedVersion:created.record.version,idempotencyKey:key()});
await approve(packageReview.reviews[0].id);

const documents = await execution(`/packages/${pkg}/documents`,'POST');
const document = documents.find(view=>view.document.kind==='purchase');
const announcement = documents.find(view=>view.document.kind==='announcement');
const notice = {code:'notice',title:'项目公告',body:'合成走查公告，仅用于测试。',required:true};
await execution(`/documents/${announcement.document.id}`,'PUT',{
  expectedVersion:announcement.document.version,sections:[notice],settings:{},
});
const rule = (key,title,stage,standard,weight) => {
  const score = weight > 0;
  return {key,title,stage,applicableTo:standard,resultType:score?'score':'pass_fail',
    minimum:'0',maximum:score?'10':'0',weight:String(weight),formula:score?'weighted_normalized':'none',
    evidenceRequired:true,scale:2,rounding:'HALF_UP'};
};
const criteria = [
  rule('Q1','资格条件','qualification','核对纸质投标文件中资格证明原件所在页。',0),
  rule('C1','实质性响应','conformity','核对纸质标书对交付要求的响应。',0),
  rule('S1','技术实施方案','technical','按计划完整性和交付可行性评定 0 至 10 分。',60),
  rule('S2','运维服务方案','commercial','按响应时效与保障措施评定 0 至 10 分。',40),
];
const tieRule = '同分按已定稿规则人工复核并记录依据。';
const sections = ['notice','instructions','demand','evaluation','contract','response'].map(code=>code==='notice' && notice ? notice : ({
  code,title:code,body:code==='evaluation'?'':`合成走查章节 ${code}，项目：{{projectTitle}}`,required:true,
}));
const draft = await execution(`/documents/${document.document.id}`,'PUT',{
  expectedVersion:document.document.version,sections,settings:{structuredScoring:JSON.stringify({criteria,tieRule})},
});
const job = await execution(`/documents/${document.document.id}/compose`,'POST',{expectedVersion:draft.document.version,idempotencyKey:key()});
let complete;
for(let i=0;i<100;i++){
  complete = await execution('/jobs/'+job.id);
  if (!['queued','processing'].includes(complete.status)) break;
  await new Promise(resolve=>setTimeout(resolve,250));
}
assert.equal(complete.status,'success',JSON.stringify(complete));
const {revisionId} = JSON.parse(complete.resultJson);
await execution(`/revisions/${revisionId}/submit`,'POST',{idempotencyKey:key(),formData:{}});
await approve(revisionId);
const artifact = await execution(`/revisions/${revisionId}/artifact`);
const download = await fetch(baseUrl+`/api/v1/buyer/attachments/${artifact.attachmentId}/download`,{headers:headers()});
assert.equal(download.status,200);
await fs.writeFile('.p0/half-flow-final.docx',Buffer.from(await download.arrayBuffer()));
const root = `/evaluation/packages/${pkg}`;
const source = (await call(root+'/rounds')).sources.find(item=>item.revisionId===revisionId);
assert.equal(source.current,true);
assert.deepEqual(source.scoringCriteria.map(row=>row.key),['Q1','C1','S1','S2']);
const config = {
  title:'纸质标书现场独立评分',documentRevisionId:revisionId,evaluationMethod:'comprehensive',
  ruleVersion:`文件定稿 V${source.inputVersion}`,ruleBasis:'定稿结构化评分办法',tieRule,
  venue:'走查评标室',scheduledAt:new Date().toISOString(),
  members:[{userId:organizer,roles:['organizer','qualification_reviewer','conformity_reviewer']},
    ...experts.map(expert=>({userId:expert.id,roles:['review_member']}))],
  rules:source.scoringCriteria.map((item,i)=>({documentRule:item,configuredRule:item,locator:`评审办法第 ${i+1} 项`,manuallyChecked:true})),
};
const altered = structuredClone(config);
altered.rules[2].configuredRule.maximum='99';
await assert.rejects(()=>call(root+'/rounds','POST',{expectedVersion:0,config:altered,reason:'篡改分值测试',idempotencyKey:key()}),/锁定的结构化评分办法一致/);
console.log('PASS 结构化规则随 DOCX 定稿，篡改专家分值配置被拒绝');

async function evidence(name, body) {
  const record = await call(`/packages/${pkg}/files`,'POST',{name,category:'demand_source',visibility:'project'});
  const version = record.versions[0];
  await uploadReceiptVersion(version.id,name,body,headers);
  return version.id;
}
const openingProof = await evidence('纸质标书开启记录.txt','合成走查：纸质标书现场接收、密封与开启登记。');
const reportProof = await evidence('合成评标报告.txt','合成走查报告，仅用于本地测试。');
const signedProof = await evidence('合成评委签署材料.txt','合成签署材料占位，仅用于查验封存版本。');
const suppliers = [];
for (const supplierName of ['测试供应商 A','测试供应商 B']) {
  suppliers.push(await execution(`/packages/${pkg}/participations`,'POST',{
    supplierName,source:'现场纸质标书登记',acquisitionStatus:'unknown',submissionStatus:'unknown',riskStatus:'pending',notes:'本地合成数据',
  }));
}
const participationIds = suppliers.map(supplier=>supplier.id);
async function startRound(title) {
  let round = await call(root+'/rounds','POST',{expectedVersion:0,config:{...config,title},reason:'合成走查轮次',idempotencyKey:key()});
  assert.deepEqual(round.blockers,[]);
  round = await call(root+`/rounds/${round.round.id}/freeze`,'POST',{
    expectedVersion:round.round.version,businessRulesReviewed:true,reason:'人工核对文件定稿、人员职责与现场条件',idempotencyKey:key(),
  });
  const materials = root+`/rounds/${round.round.id}/materials`;
  const now = Date.now();
  let plan = await call(materials+'/plan','PUT',{expectedVersion:0,config:{
    cutoffAt:new Date(now-120000).toISOString(),notBefore:new Date(now-60000).toISOString(),minimumSubjects:2,
    ruleBasis:'现场保管纸质标书，此处仅关联纸质收件登记凭证',
    items:[{key:'paper-receipt',title:'纸质标书接收凭证',required:true,readerRoles:['organizer']}],
  },reason:'合成现场接收条件',idempotencyKey:key()});
  plan = await call(materials+'/plan/confirm','POST',{expectedVersion:plan.version,reviewed:true,reason:'已核对收件条件',idempotencyKey:key()});
  for(const supplier of suppliers){
    const receipt = await call(materials+'/receipts','POST',{
      participationId:supplier.id,itemKey:'paper-receipt',fileName:'纸质标书接收凭证.txt',
      receivedAt:new Date(now-300000).toISOString(),originalType:'paper_scan',
      sourceNote:'本地测试纸质收件登记，仅作证明',note:'原标书纸质由现场保管',
      lateEntryReason:'测试补录真实接收时间',idempotencyKey:key(),
    });
    await uploadReceiptVersion(receipt.file.versions[0].id,'纸质标书接收凭证.txt',`合成收件登记 ${supplier.supplierName}`,headers);
  }
  const preview = await call(materials+'/preview','POST',{participationIds});
  assert.deepEqual(preview.blockers,[]);
  const opening = await call(materials+'/open','POST',{
    expectedVersion:plan.version,participationIds,previewFingerprint:preview.fingerprint,
    openedAt:new Date().toISOString(),evidenceVersionId:openingProof,reviewed:true,note:'人工核对纸质材料后登记开启',idempotencyKey:key(),
  });
  const startPath = root+`/rounds/${round.round.id}/assessment`;
  const start = {
    expectedRoundVersion:round.round.version,participationIds,openingEvidenceVersionId:openingProof,
    openedAt:opening.openedAt,openingReviewed:true,note:'纸质投标文件现场供评委审阅',idempotencyKey:key(),
  };
  const expertPath = root+`/rounds/${round.round.id}`;
  await assert.rejects(()=>call(startPath,'POST',start),/全部到场/);
  await assert.rejects(()=>call(expertPath+'/expert-check-in','GET',undefined,'expert1'),/failed: 403/);
  let checkIn = await call(expertPath+'/expert-draw','PUT',{
    expectedVersion:0,note:'合成外部抽取结果与冻结名单一致',proofVersionId:openingProof,
  });
  checkIn = await call(expertPath+'/expert-attendance','PUT',{
    expectedVersion:checkIn.version,userId:experts[0].id,status:'absent',note:'合成场景：专家暂未到场',
  });
  await assert.rejects(()=>call(startPath,'POST',start),/全部到场/);
  for(const expert of experts) {
    checkIn = await call(expertPath+'/expert-attendance','PUT',{
      expectedVersion:checkIn.version,userId:expert.id,status:'present',
    });
  }
  const session = await call(startPath,'POST',start);
  assert.equal((await call(expertPath+'/expert-check-in')).started,true);
  await assert.rejects(()=>call(expertPath+'/expert-attendance','PUT',{
    expectedVersion:checkIn.version,userId:experts[0].id,status:'recused',note:'启动后不得改签到',
  }),/已锁定/);
  console.log('PASS 外部抽取凭证、签到角色隔离、缺席阻断、全部签到后启动与记录锁定');
  const sessionPath = root+'/sessions/'+session.id;
  for (const [stage,criterionKey,next] of [['qualification','Q1','conformity'],['conformity','C1','evaluation']]) {
    await submit(sessionPath,stage,'creator',suppliers.map(supplier=>({
      participationId:supplier.id,criterionKey,conclusion:'pass',evidence:'合成纸质材料页码',opinion:'合成现场审查通过',
    })));
    const stages = await call(sessionPath+'/stages');
    const current = stages.stages.find(item=>item.stageKey===next);
    assert.ok(current,JSON.stringify(stages));
    await call(sessionPath+`/stages/${next}/release`,'POST',{
      prerequisiteHash:current.prerequisiteHash, participationIds, evidenceVersionId:openingProof, reviewed:true, note:'人工确认前序审查完成', reason:'人工确认前序审查完成',
      idempotencyKey:key(), exclusions:{},
    });
  }
  return {roundId:round.round.id,sessionId:session.id,sessionPath};
}
async function submit(sessionPath,stage,role,entries) {
  const query = '?stage='+stage;
  const current = await call(sessionPath+'/mine'+query,'GET',undefined,role);
  const saved = await call(sessionPath+'/mine'+query,'PUT',{expectedVersion:current.sheets[0].version,entries,idempotencyKey:key()},role);
  return call(sessionPath+'/mine/submit'+query,'POST',{expectedVersion:saved.version,personallyConfirmed:true,idempotencyKey:key()},role);
}
const validated = await startRound('半流程评分验收（已完成）');
const reviewPath = validated.sessionPath+'/paper-score-review';
assert.equal((await call(reviewPath)).submitted,0);
await assert.rejects(()=>call(reviewPath,'GET',undefined,'expert1'),/failed: 403/);
const scoreEntries = score => suppliers.flatMap(supplier=>['S1','S2'].map(criterionKey=>({
  participationId:supplier.id,criterionKey,score:String(score),evidence:'纸质标书第 5 页',opinion:'对照定稿评分标准独立核对',
})));
await assert.rejects(()=>submit(validated.sessionPath,'evaluation','expert1',scoreEntries(11)),/failed: 400/);
const first = await submit(validated.sessionPath,'evaluation','expert1',scoreEntries(8));
assert.equal(first.status,'submitted');
assert.equal((await call(reviewPath)).scores.length,0);
const secondDraft = await call(validated.sessionPath+'/mine?stage=evaluation','GET',undefined,'expert2');
assert.equal(secondDraft.sheets[0].userId,experts[1].id);
assert.deepEqual(JSON.parse(secondDraft.sheets[0].entriesJson),[]);
await assert.rejects(()=>submit(validated.sessionPath,'evaluation','expert1',scoreEntries(9)),/failed: 400/);
await submit(validated.sessionPath,'evaluation','expert2',scoreEntries(6));
const summary = await call(reviewPath);
assert.equal(summary.submitted,2);
assert.equal(summary.scores[0].average,70);
assert.equal(summary.scores[0].experts[0].marks[0].weightedScore,48);
const reviewRequest = {
  fingerprint:summary.fingerprint,filesChecked:true,note:'已核对定稿、评分表与材料封存版本',
  fileVersionId:reportProof,signedVersionIds:[signedProof],
};
await assert.rejects(()=>call(reviewPath,'POST',{...reviewRequest,fingerprint:'stale'}),/版本已变化/);
await assert.rejects(()=>call(reviewPath,'POST',{...reviewRequest,signedVersionIds:[]}),/签署材料/);
await assert.rejects(()=>call(reviewPath,'POST',{...reviewRequest,signedVersionIds:[reportProof]}),/签署材料/);
const confirmed = await call(reviewPath,'POST',reviewRequest);
assert.equal(confirmed.fileVersionId,reportProof);
assert.equal((await call(reviewPath)).review.fingerprint,confirmed.fingerprint);
assert.deepEqual((await call(reviewPath,'POST',reviewRequest)).files,confirmed.files);
assert.deepEqual(confirmed.files.map(file=>file.kind).sort(),['evaluation_report','expert_scores','score_summary','signed_material']);
assert.ok(confirmed.files.every(file=>file.ordinal===1 && /^[a-f0-9]{64}$/.test(file.sha256)));
console.log('PASS 双专家隔离、超分拦截、提交锁定、齐交后汇总、核对留痕与四类材料封存');

const archivePath = `/packages/${pkg}/archive`;
const archive = await call(archivePath);
assert.equal(archive.reviewedEvaluationFiles.length,4);
assert.ok(archive.checklist.filter(row=>['opening','report'].includes(row.key)).every(row=>row.disposition==='included'));
const archiveDraft = {expectedFingerprint:archive.sourceFingerprint,expectedPreviousId:null,complete:false,
  retentionYears:10,reason:'合成走查：先封存评标材料，项目其余材料后续补齐',reviewed:true,idempotencyKey:key()};
await assert.rejects(()=>call(archivePath+'/snapshots','POST',{...archiveDraft,complete:true}),/缺失或适用性尚未核对/);
const snapshot = await call(archivePath+'/snapshots','POST',archiveDraft);
assert.equal(snapshot.ordinal,1);
assert.equal(snapshot.complete,false);
const zip = await fetch(baseUrl+'/api/v1/buyer/agency'+archivePath+`/snapshots/${snapshot.id}/export`,{headers:headers()});
assert.equal(zip.status,200);
await fs.writeFile('.p0/half-flow-evaluation-archive.zip',Buffer.from(await zip.arrayBuffer()));
await fs.writeFile('.p0/half-flow-evaluation-archive-expected.json',JSON.stringify({snapshot,files:confirmed.files}));
console.log('PASS 已核对版本纳入正式项目档案快照，补件状态与导出保留');

const ready = await startRound('半流程评分操作走查（待专家评分）');
await fs.writeFile('.p0/half-flow-walkthrough.json',JSON.stringify({packageId:pkg,revisionId,validated,ready},null,2),{mode:0o600});
console.log('Walkthrough package: '+pkg);
