import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
const base = process.env.JAVA_API_BASE_URL;
assert.ok(base && new URL(base).hostname === '127.0.0.1' && new URL(base).port !== '8080' && process.env.ACCEPTANCE_LOCAL_WRITES === '1');
const id = `tdr-${Date.now()}`;
const report = { tenantId: id, buyerAccount: `${id}@example.com`, checks: [], records: {}, passed: false };
const password = process.env.ACCEPTANCE_PASSWORD;
async function api(path, token, body, method = body === undefined ? 'GET' : 'POST', expected = [200,201]) {
  const r = await fetch(`${base}/api/v1/${path}`, { method, signal: AbortSignal.timeout(30000), headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const value = await r.json();
  assert.ok(expected.includes(r.status), `${path}: ${r.status} ${value.message}`);
  return value.data;
}
try {
  const platform = await api('auth/login', null, { account: 'platform.admin@example.com', password, scope: 'PLATFORM' });
  await api('platform/tenants', platform.accessToken, { tenantId:id, enterpriseId:`ent-${id}`, name:`文件审查隔离验收 ${id}`, industry:'通用采购', plan:'MVP', userLimit:10, enabledFeatures:['method:tender','rfq','order'], adminName:'文件编制人', adminEmail:report.buyerAccount, adminPassword:password });
  const login = account => api('auth/login', null, { account, password, scope:'BUYER', tenantId:id });
  const buyer=await login(report.buyerAccount), b=buyer.accessToken;
  const role=(await api('buyer/roles', b)).find(r=>r.permissions.includes('buyer:*'));
  const department=await api('buyer/departments',b,{name:'采购文件审查部'});
  const reviewerAccount=`review-${id}@example.com`;
  const reviewer=await api('buyer/users',b,{name:'独立文件审查人',email:reviewerAccount,status:'active',departmentId:department.id,roleId:role.id,initialPassword:password});
  const r=(await login(reviewerAccount)).accessToken;
  const draft={title:`采购文件审查 ${id}`,tenderType:'邀请招标',budget:1200,documentHtml:'<p>第一版文件</p>',evaluationMethod:'综合评分法',acquisitionDeadline:new Date(Date.now()+5*86400000).toISOString(),submissionDeadline:new Date(Date.now()+6*86400000).toISOString(),openingAt:new Date(Date.now()+7*86400000).toISOString()};
  const tender=await api('buyer/tenders',b,draft), path=`buyer/tenders/${tender.id}`;
  async function upload(fileName) {
    const payload={ownerType:'tender',ownerId:tender.id,fileName,visibility:'buyer_internal'};
    const ticket=await api('buyer/attachments/upload-ticket',b,payload);
    const uploaded=await fetch(base+ticket.uploadUrl,{method:'POST',headers:{Authorization:`Bearer ${b}`,'Content-Type':'application/octet-stream'},body:Buffer.from(`SYNTHETIC ${fileName}`)});
    assert.ok(uploaded.ok);
    return api('buyer/attachments',b,{...payload,storageKey:ticket.storageKey});
  }
  const originalAttachment=await upload('送审原件.txt');
  report.records.tenderId=tender.id;
  await api(`${path}/publish`,b,{},'POST',[400]);
  await api(`${path}/document-reviews`,b,{formData:{}},'POST',[400]);
  assert.equal((await api(`${path}/document-reviews`,b)).reviews.length,0);
  report.checks.push('unreviewed publication blocked; missing published workflow rolls back review');
  const definition=await api('buyer/process-definitions',b,{name:'采购文件独立审查',businessType:'tender_document_review',icon:'file-text'});
  await api(`buyer/process-definitions/${definition.id}`,b,{name:definition.name,businessType:'tender_document_review',status:'draft',formSchema:'{"fields":[]}',flowSchema:JSON.stringify({steps:[{id:'review',type:'approver',title:'独立审查',assignment:{type:'role',roleId:role.id}}]})},'PUT');
  await api(`buyer/process-definitions/${definition.id}/publish`,b,{});
  async function submit() { const state=await api(`${path}/document-reviews`,b,{formData:{}});return state.reviews[0]; }
  async function decide(review,action) {
    const task=(await api('buyer/workflow/tasks',r)).find(t=>t.businessType==='tender_document_review' && t.businessId===review.id);
    assert.ok(task);
    await api(`buyer/workflow/tasks/${task.taskId}/complete`,b,{action:'approve',comment:'尝试自审'},'POST',[400,403]);
    await api(`buyer/workflow/tasks/${task.taskId}/complete`,r,{action,comment:`独立审查${action}`});
  }
  const first=await submit();
  await api(`${path}/document-reviews`,b,{formData:{}},'POST',[400]);
  await api(path,b,draft,'PUT',[400]);
  await api(`${path}/prequalification`,b,{required:true},'PUT',[400]);
  await api('buyer/attachments/upload-ticket',b,{ownerType:'tender',ownerId:tender.id,fileName:'pending.txt',visibility:'internal'},'POST',[400]);
  await decide(first,'reject');
  report.checks.push('pending file/attachment/settings lock, duplicate submit and self-approval rejection');
  const revised={...draft,documentHtml:'<p>修订版采购文件</p>'};
  await api(path,b,revised,'PUT');
  const second=await submit();await decide(second,'approve');
  assert.equal((await api(`${path}/document-reviews`,b)).currentApproved,true);
  const addedAttachment=await upload('补充资料.txt');
  assert.equal((await api(`${path}/document-reviews`,b)).currentApproved,false);
  await api(path,b,{...revised,title:revised.title+'调整'},'PUT');
  assert.equal((await api(`${path}/document-reviews`,b)).currentApproved,false);
  await api(`${path}/publish`,b,{},'POST',[400]);
  report.checks.push('rejection resubmission and exact-version approval invalidation');
  const third=await submit();await decide(third,'approve');
  const history=(await api(`${path}/document-reviews`,b)).reviews;
  assert.equal(history.length,3);assert.ok(history.every(h=>h.completedBy===reviewer.id && h.comment));
  const wf=await api(`buyer/workflow/instances/business/tender_document_review/${third.id}/history`,r);
  assert.ok(wf.businessSnapshot);assert.ok(wf.flowableProcessInstanceId);
  const old=await api(`buyer/workflow/instances/business/tender_document_review/${first.id}/history`,r);
  assert.ok(old.attachments.some(a=>a.id===originalAttachment.id));
  assert.ok(!old.attachments.some(a=>a.id===addedAttachment.id));
  assert.equal(wf.attachments.length,2);
  assert.equal((await api(`${path}/publish`,b,{})).status,'发售中');
  await api('buyer/attachments/upload-ticket',b,{ownerType:'tender',ownerId:tender.id,fileName:'published.txt',visibility:'buyer_internal'},'POST',[400]);
  report.checks.push('three immutable review rounds with actual actor/history/snapshot and final publication');
  report.records.reviewIds=history.map(h=>h.id);report.reviewerAccount=reviewerAccount;report.passed=true;
  report.records.draftId=(await api('buyer/tenders',b,{...draft,title:'待审采购文件示例'})).id;
} catch(e) { report.error=e.message;process.exitCode=1; }
finally { writeFileSync(process.env.ACCEPTANCE_REPORT_PATH,JSON.stringify(report,null,2));console.log(JSON.stringify(report)); }
