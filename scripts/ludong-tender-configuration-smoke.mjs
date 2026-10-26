import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const base = 'http://127.0.0.1:8098';
const requests = [];
async function api(path, token, method='GET', body, expected=200) {
  const response = await fetch(base+path, {method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
    body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  const json=await response.json();
  assert.equal(response.status,expected,`${method} ${path}: ${json.message}`);
  requests.push({method,path,status:response.status});
  return json.data;
}
const login=async(account)=>(await api('/api/v1/auth/login','','POST',{
  account,password:'demo123456',scope:'BUYER',tenantId:'tenant-ludong-poc',
})).accessToken;
const admin=await login('LDU000001'), applicant=await login('LDU100001'), reviewer=await login('LDU200002');
const definitions='/api/v1/buyer/process-definitions';
const original=(await api(definitions,admin)).find(item=>item.businessType==='ludong_project_application');
assert.ok(original?.activeVersionId,'An existing school published version is required');
const versions=await api(`${definitions}/${original.id}/versions`,admin);
const published=versions.find(item=>item.id===original.activeVersionId);
assert.ok(published);
const draft=JSON.parse(readFileSync(resolve(root,'scripts/fixtures/ludong-tender-application.json'),'utf8'));
const path=id=>`/api/v1/buyer/ludong-poc/applications/${id}`;
const history=id=>api(`/api/v1/buyer/workflow/instances/business/ludong_project_application/${id}/history`,admin);
const create=title=>api('/api/v1/buyer/ludong-poc/applications',applicant,'POST',{...draft,projectName:title});
async function save(config) {
  return api(`${definitions}/${original.id}`,admin,'PUT',{
    name:original.name,description:original.description,status:'draft',businessType:original.businessType,
    formSchema:config.formSchema,flowSchema:config.flowSchema,
  });
}
const publish=async config=>{await save(config); return api(`${definitions}/${original.id}/publish`,admin,'POST');};
const old=await create('流程版本隔离验收A（合成演示）');
await api(path(old.id)+'/submit',applicant,'POST');
const oldState=await history(old.id);
const baseline={...original,formSchema:oldState.formSchema,flowSchema:oldState.flowSchema};
let changed=false;
const output=resolve(root,'.ludong-tender-runtime/configuration-acceptance');mkdirSync(output,{recursive:true});
try {
  const form=JSON.parse(baseline.formSchema);
  form.attachmentCategories=[
    {id:'project_attachment',label:'项目附件',required:false},
    {id:'mall_confirmation',label:'商城确认材料',required:false},
    {id:'supplementary_evidence',label:'补充证明',required:false},
    {id:'custom_1',label:'市场调研报告',required:true},
  ];
  const custom={id:'tender_special_review',type:'approver',title:'采购专项复核B',deadlineHours:48,
    assignment:{type:'user',userId:'user-ldu-it-review'}};
  const flow=JSON.parse(baseline.flowSchema);
  const route={id:'tender_budget_route',type:'condition',title:'专项复核金额规则',branches:[
    {label:'15万元及以上',condition:{field:'$amount',op:'>=',value:'150000'},steps:[custom]},
    {label:'其他金额',steps:[]},
  ]};
  const b={formSchema:JSON.stringify(form),flowSchema:JSON.stringify({steps:[route,...flow.steps]})};
  changed=true;
  await save({...b,flowSchema:JSON.stringify({steps:[{...custom,deadlineHours:0},...flow.steps]})});
  await api(`${definitions}/${original.id}/publish`,admin,'POST',undefined,400);
  await save({...b,formSchema:JSON.stringify({...form,attachmentCategories:form.attachmentCategories.map(item=>({...item,label:'../非法目录'}))})});
  await api(`${definitions}/${original.id}/publish`,admin,'POST',undefined,400);
  const versionB=await publish(b);
  await api(`${definitions}/${original.id}/publish`,applicant,'POST',undefined,403);
  const current=await create('自定义流程与附件归档验收B（合成演示）');
  await api(path(current.id)+'/submit',applicant,'POST',undefined,400);
  assert.equal((await api(path(current.id),admin)).status,'draft');
  assert.equal(await history(current.id),null);
  const metadata={ownerType:'ludong_poc_custom_1',ownerId:current.id,fileName:'市场调研报告（合成验收）.txt',visibility:'buyer_internal'};
  const ticket=await api('/api/v1/buyer/attachments/upload-ticket',applicant,'POST',metadata);
  const uploadUrl=new URL(ticket.uploadUrl,base);assert.equal(uploadUrl.origin,base);
  uploadUrl.searchParams.set('contentType','text/plain');
  const content=Buffer.from('合成验收材料：采集通道及接口已完成市场调研。');
  assert.equal((await fetch(uploadUrl,{method:'POST',headers:{Authorization:`Bearer ${applicant}`,'Content-Type':'application/octet-stream'},body:content})).status,200);
  const attachment=await api('/api/v1/buyer/attachments',applicant,'POST',{...metadata,storageKey:ticket.storageKey},201);
  await api(path(current.id)+'/submit',applicant,'POST');
  const stateB=await history(current.id);
  assert.equal(stateB.definitionVersionId,versionB.activeVersionId);
  assert.equal(stateB.currentTask.taskDefinitionKey,'task_tender_special_review');
  assert.deepEqual(stateB.currentTask.candidateUserIds,['user-ldu-it-review']);
  const timing=await api(`/api/v1/buyer/workflow/tasks/${stateB.currentTask.taskId}/timing`,reviewer);
  assert.ok(Math.abs(new Date(timing.dueAt)-Date.now()-48*3600000)<60000,'Flowable must create the configured real due date');
  const small=await api('/api/v1/buyer/ludong-poc/applications',applicant,'POST',{
    ...draft,projectName:'金额条件低额分支验收（合成演示）',items:draft.items.map(item=>({...item,quantity:'1'})),
  });
  const smallTicket=await api('/api/v1/buyer/attachments/upload-ticket',applicant,'POST',{...metadata,ownerId:small.id});
  const smallUrl=new URL(smallTicket.uploadUrl,base);assert.equal(smallUrl.origin,base);
  assert.equal((await fetch(smallUrl,{method:'POST',headers:{Authorization:`Bearer ${applicant}`,'Content-Type':'application/octet-stream'},body:content})).status,200);
  await api('/api/v1/buyer/attachments',applicant,'POST',{...metadata,ownerId:small.id,storageKey:smallTicket.storageKey},201);
  await api(path(small.id)+'/submit',applicant,'POST');
  assert.equal((await history(small.id)).currentTask.taskDefinitionKey,oldState.currentTask.taskDefinitionKey);
  const versionC=await publish({...b,formSchema:JSON.stringify({...form,attachmentCategories:form.attachmentCategories.map(item=>({...item,label:item.id==='custom_1'?'预算补充说明':item.label,required:false}))}),
    flowSchema:JSON.stringify({steps:[{...custom,title:'预算复核C',assignment:{type:'user',userId:'user-ldu-unit-manager'},deadlineHours:12},...flow.steps]})});
  const c=await create('新版自定义审批节点演示C（合成演示）');await api(path(c.id)+'/submit',applicant,'POST');
  const cState=await history(c.id);
  assert.equal(cState.definitionVersionId,versionC.activeVersionId);
  assert.deepEqual(cState.currentTask.candidateUserIds,['user-ldu-unit-manager']);
  assert.equal(cState.currentTask.taskName,'预算复核C');
  const originalUnchanged=await history(old.id), bUnchanged=await history(current.id);
  assert.equal(originalUnchanged.definitionVersionId,oldState.definitionVersionId);
  assert.equal(originalUnchanged.currentTask.taskId,oldState.currentTask.taskId);
  assert.equal(bUnchanged.currentTask.taskName,'采购专项复核B');
  assert.deepEqual(JSON.parse(bUnchanged.flowSchema),JSON.parse(b.flowSchema));
  assert.equal((await api(path(current.id)+'/attachment-categories',admin)).find(item=>item.id==='custom_1').label,'市场调研报告');
  const task=stateB.currentTask;
  await api(`/api/v1/buyer/ludong-poc/tasks/${task.taskId}/complete`,reviewer,'POST',{
    applicationId:current.id,nodeId:task.taskDefinitionKey,action:'approve',comment:'不同意不能通过',reviewData:{customNodeOpinion:'不同意'},
  },400);
  if (process.argv.includes('--verify-overdue')) {
    // Only this newly created synthetic task in the fixed isolated DB is backdated. No original data or clock changes.
    assert.match(task.taskId,/^[A-Za-z0-9_-]+$/);
    const secrets=JSON.parse(readFileSync(resolve(root,'.ludong-tender-runtime/secrets.json'),'utf8'));
    const sql=`update act_ru_task set due_date_=now()-interval '1 second' where id_='${task.taskId}' and tenant_id_='tenant-ludong-poc';`;
    const result=spawnSync('docker',['compose','-f',resolve(root,'infra/ludong-tender-poc/compose.yml'),'exec','-T','postgres','psql','-U','ludong_poc','-d','ludong_tender_poc','-v','ON_ERROR_STOP=1','-c',sql],
      {env:{...process.env,...secrets},encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/UPDATE 1/);
    const until=Date.now()+40000;
    while(Date.now()<until && !(await history(current.id)).events.some(event=>event.comment?.startsWith('系统超期提醒'))) await new Promise(r=>setTimeout(r,1500));
    const alerted=await history(current.id);
    assert.equal(alerted.events.filter(event=>event.comment?.startsWith('系统超期提醒')).length,1);
    await new Promise(r=>setTimeout(r,12000));
    assert.equal((await history(current.id)).events.filter(event=>event.comment?.startsWith('系统超期提醒')).length,1,'No repeated notification for the same due date');
    const notices=await api('/api/v1/buyer/notifications',reviewer);
    assert.ok(notices.some(item=>item.title==='审批任务超期提醒'&&item.content.includes(current.id)));
    assert.equal((await history(current.id)).status,'processing','Overdue never auto-approves or rejects');
  }
  await api(`/api/v1/buyer/ludong-poc/tasks/${task.taskId}/complete`,reviewer,'POST',{
    applicationId:current.id,nodeId:task.taskDefinitionKey,action:'approve',comment:'按专项范围审核',
    reviewData:{customNodeOpinion:'同意',customNodeComment:'专项复核材料齐全（合成演示）'},
  });
  assert.ok((await api(path(current.id)+`/approval-records?instanceId=${stateB.workflowInstanceId}`,admin)).some(item=>item.nodeId==='tender_special_review'));
  const forms={
    task_argumentation_review:['LDU200001',{argumentationOpinion:'同意',argumentationComment:'必要性充分'}],
    task_technical_leader_review:['LDU200017',{technicalLeaderOpinion:'同意'}],
    task_unit_review:['LDU200003',{applicantUnitOpinion:'同意'}],task_funding_review:['LDU200004',{fundingUnitOpinion:'同意'}],
    task_lab_equipment_review:['LDU200008',{largeEquipmentSharing:'同意共享',labReviewOpinion:'同意'}],
    task_lab_division_leader_review:['LDU200009',{labDivisionLeaderOpinion:'同意'}],task_lab_unit_leader_review:['LDU200010',{labUnitLeaderOpinion:'同意'}],
    task_finance_budget_review:['LDU200012',{financeBudgetStatus:'本项目已列入本年度学校预算'}],
    task_procurement_budget_review:['LDU200013',{procurementBudgetStatus:'本项目已列入本年度采购预算'}],
    task_handover_submit:['LDU100001',{handoverSubmitConfirmation:'材料完整，确认提交'}],
    task_handover_accept:['LDU200014',{handoverAcceptance:'材料齐全，确认受理'}],
    task_procurement_method_review:['LDU200015',{procurementMethod:'询价'}],task_finance_responsible_review:['LDU200016',{financeResponsibleOpinion:'同意'}],
  };
  for(let index=0;index<25;index++){
    const state=await history(current.id);if(state.status==='approved')break;
    const config=forms[state.currentTask.taskDefinitionKey];assert.ok(config);
    await api(`/api/v1/buyer/ludong-poc/tasks/${state.currentTask.taskId}/complete`,await login(config[0]),'POST',{
      applicationId:current.id,nodeId:state.currentTask.taskDefinitionKey,action:'approve',comment:'配置验收完整流程',reviewData:config[1],
    });
  }
  assert.equal((await history(current.id)).status,'approved');
  const response=await fetch(base+path(current.id)+'/documents/archive.zip',{headers:{Authorization:`Bearer ${admin}`}});
  assert.equal(response.status,200);const archive=resolve(output,'自定义分类项目归档.zip');writeFileSync(archive,Buffer.from(await response.arrayBuffer()));
  const check=spawnSync('python3',['-c','import sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); n=next(n for n in z.namelist() if n.startswith("05-市场调研报告/") and n.endswith(".txt")); assert "合成验收材料" in z.read(n).decode(); print(n)',archive],{encoding:'utf8'});
  assert.equal(check.status,0,check.stderr);
  writeFileSync(resolve(output,'result.json'),JSON.stringify({result:'PASS',at:new Date().toISOString(),applicationIds:{a:old.id,b:current.id,c:c.id,small:small.id},
    versions:{a:oldState.definitionVersionId,b:stateB.definitionVersionId,c:cState.definitionVersionId},overdue:process.argv.includes('--verify-overdue'),attachmentId:attachment.id,requests},null,2));
  console.log(`PASS: ${requests.length} HTTP requests; real version isolation, custom node/assignee/amount route, deadline, required custom attachment, final flow and ZIP.`);
} finally {
  if(changed){await publish(baseline);await save(original);console.log('Original published content restored as a new immutable version; previous instances and test data retained.');}
}
