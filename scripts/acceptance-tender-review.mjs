import assert from 'node:assert/strict';

export async function approveAcceptanceTender(api, buyer, reviewer, tenderId) {
  assert.equal(process.env.ACCEPTANCE_LOCAL_WRITES, '1');
  const review=(await api(`buyer/tenders/${tenderId}/document-reviews`,buyer,{formData:{}})).reviews[0];
  const task=(await api('buyer/workflow/tasks',reviewer)).find(t=>t.businessType==='tender_document_review'&&t.businessId===review.id);
  assert.ok(task,'Independent document reviewer must have a real Flowable task');
  await api(`buyer/workflow/tasks/${task.taskId}/complete`,reviewer,{action:'approve',comment:'隔离验收：采购文件已人工核对'});
  assert.equal((await api(`buyer/tenders/${tenderId}/document-reviews`,buyer)).currentApproved,true);
}
