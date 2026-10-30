import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root=resolve(dirname(fileURLToPath(import.meta.url)), '..');
const base='http://127.0.0.1:8098';
const requests=[];
async function api(path, token, method='GET', body, status=200) {
  const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},
    body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  const text=await response.text();
  assert.equal(response.status,status,`${method} ${path}: ${text.slice(0,600)}`);
  requests.push({path,method,status});
  return text?JSON.parse(text).data:null;
}
const sessions=new Map();
async function login(account) {
  if(!sessions.has(account)) sessions.set(account,(await api('/api/v1/auth/login',null,'POST',{
    account,password:'demo123456',scope:'BUYER',tenantId:'tenant-ludong-poc',
  })).accessToken);
  return sessions.get(account);
}
const admin=await login('LDU000001'), applicant=await login('LDU100001'), a=await login('LDU200001'), b=await login('LDU200002');
const tech=await login('LDU200017'), unit=await login('LDU200003');
const fixture=JSON.parse(readFileSync(resolve(root,'scripts/fixtures/ludong-tender-application.json'),'utf8'));
fixture.projectName='采购申报前置加审验证项目（首版）';
fixture.formData.argumentationOpinion='伪造通过';
fixture.formData.argumentationComment='INJECTED-APPROVAL';
const app=await api('/api/v1/buyer/ludong-poc/applications',applicant,'POST',fixture);
assert.equal(app.formData.argumentationOpinion,undefined);
const appPath=`/api/v1/buyer/ludong-poc/applications/${app.id}`;
const history=()=>api(`/api/v1/buyer/workflow/instances/business/ludong_project_application/${app.id}/history`,admin);
const operation=(task, suffix, token, body, status=200)=>api(`/api/v1/buyer/workflow/tasks/${task.taskId}/${suffix}`,token,'POST',body,status);
const approve=(task,token,data,action='approve',status=200)=>api(`/api/v1/buyer/ludong-poc/tasks/${task.taskId}/complete`,token,'POST',{
  applicationId:app.id,nodeId:task.taskDefinitionKey,action,comment:'按本轮实际材料办理',reviewData:data,
},status);
await api(appPath+'/submit',applicant,'POST');
const first=await history(); let task=first.currentTask;
assert.deepEqual(await api(`/api/v1/buyer/workflow/tasks/${task.taskId}/return-targets`,a),[]);
await operation(task,'return',a,{targetNodeId:'task_finance_responsible_review',reason:'不得跳到未来节点'},400);
await operation(task,'additional-reviews',b,{reviewerId:'user-ldu-unit-manager',reason:'非办理人不可加审'},403);
const extra=await operation(task,'additional-reviews',a,{reviewerId:'user-ldu-it-review',reason:'请补充核验技术资料'});
assert.equal(extra.status,'pending');
assert.equal((await api(`/api/v1/buyer/workflow/tasks/${task.taskId}/timing`,b)).additionalReview,true);
assert.ok(!(await api('/api/v1/buyer/workflow/tasks',a)).some(item=>item.taskId===task.taskId));
await approve(task,b,{argumentationOpinion:'同意',argumentationComment:'不得绕过加审入口'},'approve',400);
await operation(task,'operations',b,{action:'transfer',recipientIds:['user-ldu-unit-manager'],reason:'不得绕过加审'},400);
await operation(task,'additional-reviews',b,{reviewerId:'user-ldu-unit-manager',reason:'不得嵌套加审'},400);
await operation(task,'additional-decision',b,{reviewId:extra.id,action:'reject',comment:'技术资料不足，请补充证明后再审。'});
assert.equal((await api(`/api/v1/buyer/workflow/tasks/${task.taskId}/timing`,a)).additionalRejected,true);
await approve(task,a,{argumentationOpinion:'同意',argumentationComment:'加审不同意不得通过'},'approve',400);
await approve(task,a,{},'reject');
assert.equal((await api(appPath,admin)).status,'rejected');
assert.equal((await api(`/api/v1/buyer/workflow/instances/${first.workflowInstanceId}/additional-reviews`,admin))[0].status,'rejected');

await api(appPath,applicant,'PUT',fixture);
await api(appPath+'/submit',applicant,'POST');
const second=await history(); task=second.currentTask;
assert.notEqual(second.workflowInstanceId,first.workflowInstanceId);
assert.equal((await api(appPath,admin)).formData.argumentationOpinion,undefined);
const positive=await operation(task,'additional-reviews',a,{reviewerId:'user-ldu-it-review',reason:'补件后进行专业复核'});
await operation(task,'additional-decision',b,{reviewId:extra.id,action:'approve',comment:'旧加审编号不能办理新一轮'},403);
await operation(task,'additional-decision',b,{reviewId:positive.id,action:'approve',comment:'本轮专业复核资料齐全。'});
await approve(task,a,{argumentationOpinion:'同意',argumentationComment:'ROUND-OLD-ARGUMENTATION'});
task=(await history()).currentTask;
assert.equal(task.taskDefinitionKey,'task_technical_leader_review');
await approve(task,tech,{technicalLeaderOpinion:'同意',technicalLeaderComment:'ROUND-OLD-TECHNICAL'});
task=(await history()).currentTask;
assert.equal(task.taskDefinitionKey,'task_unit_review');
const targets=await api(`/api/v1/buyer/workflow/tasks/${task.taskId}/return-targets`,unit);
assert.ok(targets.some(item=>item.nodeId==='task_argumentation_review'));
await operation(task,'return',unit,{targetNodeId:'task_argumentation_review',reason:'补充必要性说明后重新论证'});
let returned=await history();
assert.equal(returned.currentTask.taskDefinitionKey,'task_argumentation_review');
assert.ok(returned.events.some(item=>item.action==='approved'&&item.effective===false));
let projected=await api(appPath,admin);
assert.equal(projected.formData.argumentationOpinion,undefined);
assert.equal(projected.formData.technicalLeaderOpinion,undefined);
const oldRecords=await api(appPath+`/approval-records?instanceId=${second.workflowInstanceId}`,admin);
assert.ok(oldRecords.some(item=>item.reviewDataJson.includes('ROUND-OLD-ARGUMENTATION')));
await approve(task,unit,{applicantUnitOpinion:'同意'},'approve',403);
await approve(returned.currentTask,a,{argumentationOpinion:'同意',argumentationComment:'ROUND-REWORK-ARGUMENTATION'});
task=(await history()).currentTask;
assert.equal(task.taskDefinitionKey,'task_technical_leader_review','Old employee approval must not skip the returned round');
await approve(task,tech,{technicalLeaderOpinion:'同意',technicalLeaderComment:'ROUND-REWORK-TECHNICAL'});
task=(await history()).currentTask;
assert.equal(task.taskDefinitionKey,'task_unit_review','Same employee reuse must still work within the new round');
await api(`/api/v1/buyer/workflow/instances/${second.workflowInstanceId}/withdraw-ludong-application`,unit,'POST',{reason:'非发起人不得撤回'},403);
await api(`/api/v1/buyer/workflow/instances/${second.workflowInstanceId}/withdraw-ludong-application`,applicant,'POST',{reason:'修改采购数量后重新提交'});
assert.equal((await history()).status,'cancelled');
projected=await api(appPath,admin);
assert.equal(projected.status,'draft');
assert.equal(projected.formData.argumentationOpinion,undefined);
await approve(task,unit,{applicantUnitOpinion:'同意'},'approve',403);
fixture.projectName='采购申报重审与归档验收项目（修订版）';
fixture.items[0].quantity='3';
await api(appPath,applicant,'PUT',fixture);
await api(appPath+'/submit',applicant,'POST');
const third=await history();
assert.notEqual(third.workflowInstanceId,second.workflowInstanceId);
assert.equal(third.businessSnapshot.projectName,fixture.projectName);
assert.equal(third.businessSnapshot.budgetAmount,255000);
const original=await api(`/api/v1/buyer/workflow/instances/${first.workflowInstanceId}/history`,admin);
assert.equal(original.businessSnapshot.projectName,'采购申报前置加审验证项目（首版）');
assert.equal(original.businessSnapshot.budgetAmount,170000);
const page=await api(`/api/v1/buyer/workflow/instances/business/ludong_project_application/${app.id}/instances?page=2&pageSize=1`,admin);
assert.equal(page.total,3); assert.equal(page.items.length,1);

const forms={
  task_argumentation_review:['LDU200001',{argumentationOpinion:'同意',argumentationComment:'FINAL-ROUND-必要性论证通过'}],
  task_technical_leader_review:['LDU200017',{technicalLeaderOpinion:'同意',technicalLeaderComment:'FINAL-ROUND-技术参数确认'}],
  task_unit_review:['LDU200003',{applicantUnitOpinion:'同意',applicantUnitComment:'修订材料已核实'}],
  task_funding_review:['LDU200004',{fundingUnitOpinion:'同意'}],
  task_lab_equipment_review:['LDU200008',{largeEquipmentSharing:'同意共享',labReviewOpinion:'同意'}],
  task_lab_division_leader_review:['LDU200009',{labDivisionLeaderOpinion:'同意'}],
  task_lab_unit_leader_review:['LDU200010',{labUnitLeaderOpinion:'同意'}],
  task_finance_budget_review:['LDU200012',{financeBudgetStatus:'本项目已列入本年度学校预算'}],
  task_procurement_budget_review:['LDU200013',{procurementBudgetStatus:'本项目已列入本年度采购预算'}],
  task_handover_submit:['LDU100001',{handoverSubmitConfirmation:'材料完整，确认提交'}],
  task_handover_accept:['LDU200014',{handoverAcceptance:'材料齐全，确认受理'}],
  task_procurement_method_review:['LDU200015',{procurementMethod:'询价'}],
  task_finance_responsible_review:['LDU200016',{financeResponsibleOpinion:'同意'}],
};
for(let i=0;i<25;i++) {
  const state=await history();
  if(state.status==='approved')break;
  assert.ok(state.currentTask,'Active workflow is missing a task');
  const config=forms[state.currentTask.taskDefinitionKey];
  assert.ok(config,`Unexpected real approval node: ${state.currentTask.taskDefinitionKey}`);
  await approve(state.currentTask,await login(config[0]),config[1]);
}
assert.equal((await history()).status,'approved');
const out=resolve(root,'.ludong-tender-runtime/rework-acceptance'); mkdirSync(out,{recursive:true});
for(const [kind,name] of [['demand.docx','采购需求表.docx'],['application.docx','采购申请单.docx'],['archive.zip','项目归档.zip']]) {
  const response=await fetch(base+appPath+`/documents/${kind}`,{headers:{Authorization:`Bearer ${admin}`}});
  assert.equal(response.status,200); const file=resolve(out,name); writeFileSync(file,Buffer.from(await response.arrayBuffer()));
  if(kind.endsWith('.docx')) {
    const result=spawnSync('python3',['-c','import sys,zipfile,xml.etree.ElementTree as E; z=zipfile.ZipFile(sys.argv[1]); print("".join(E.fromstring(z.read("word/document.xml")).itertext()))',file],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr); const text=result.stdout;
    assert.ok(text.includes(fixture.projectName),'Export must contain the revised project name');
    for(const forbidden of ['INJECTED-APPROVAL','ROUND-OLD-','ROUND-REWORK-'])assert.ok(!text.includes(forbidden),`Export leaked superseded approval: ${forbidden}`);
    assert.ok(text.includes(kind==='demand.docx'?'技术与材料编制人':'购置必要性论证人'),
      'Each original template must contain its own actual latest-round signatories');
    if(kind==='application.docx') assert.ok(text.includes('FINAL-ROUND-必要性论证通过'));
  } else {
    const listing=spawnSync('python3',['-c','import sys,zipfile; print("\\n".join(zipfile.ZipFile(sys.argv[1]).namelist()))',file],{encoding:'utf8'}); assert.equal(listing.status,0,listing.stderr);
    assert.ok(listing.stdout.includes('采购需求表')); assert.ok(listing.stdout.includes('采购及招标申请单'));
  }
}
assert.equal((await api(appPath,admin)).status,'archived');
const cancelApp=await api('/api/v1/buyer/ludong-poc/applications',applicant,'POST',{
  ...fixture,projectName:'前置加审中撤回验证项目（演示）',
});
await api(`/api/v1/buyer/ludong-poc/applications/${cancelApp.id}/submit`,applicant,'POST');
const cancelHistory=await api(`/api/v1/buyer/workflow/instances/business/ludong_project_application/${cancelApp.id}/history`,admin);
await operation(cancelHistory.currentTask,'additional-reviews',a,{reviewerId:'user-ldu-it-review',reason:'用于验证加审中撤回完整取消'});
await api(`/api/v1/buyer/workflow/instances/${cancelHistory.workflowInstanceId}/withdraw-ludong-application`,applicant,'POST',{reason:'加审办理中撤回修改'});
assert.equal((await api(`/api/v1/buyer/ludong-poc/applications/${cancelApp.id}`,admin)).status,'draft');
assert.equal((await api(`/api/v1/buyer/workflow/instances/${cancelHistory.workflowInstanceId}/additional-reviews`,admin))[0].status,'cancelled');
assert.ok(!(await api('/api/v1/buyer/workflow/tasks',b)).some(item=>item.taskId===cancelHistory.currentTask.taskId));
writeFileSync(resolve(out,'result.json'),JSON.stringify({result:'PASS',at:new Date().toISOString(),applicationId:app.id,
  rounds:[first.workflowInstanceId,second.workflowInstanceId,third.workflowInstanceId],requests,checks:[
    'Native Flowable delegation and owner resumption','Negative additional decision blocks approval','Bounded previous-node return',
    'Superseded forms and signatures excluded','Employee reuse resets on returned round','Withdrawal cancels tasks and restores draft',
    'Resubmission preserves immutable snapshots and paged history','Full revised flow completes and exports two DOCX plus ZIP',
  ]},null,2));
console.log(`PASS: ${requests.length} HTTP requests; add-review, return, withdrawal, resubmission, full final approval and actual Word/ZIP verification.`);
