import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('finance approval and audit flow', () => {
  it('models payment requests as approval tasks with templates and inbox summaries', () => {
    const businessType = read('backend-java/src/main/java/com/procurement/approval/domain/ApprovalBusinessType.java');
    const templateCode = read('backend-java/src/main/java/com/procurement/approval/domain/ApprovalTemplateCode.java');
    const inboxService = read('backend-java/src/main/java/com/procurement/approval/application/ApprovalInboxApplicationService.java');
    const paymentRequestMigration = read('backend-java/src/main/resources/db/migration/V103__finance_approval_templates.sql');
    const paymentBatchMigration = read('backend-java/src/main/resources/db/migration/V106__payment_batch_approval_template.sql');

    expect(businessType).toContain('PAYMENT_REQUEST = "payment_request"');
    expect(businessType).toContain('PAYMENT_BATCH = "payment_batch"');
    expect(templateCode).toContain('PAYMENT_REQUEST = "TPL_PAYMENT_REQUEST"');
    expect(templateCode).toContain('PAYMENT_BATCH = "TPL_PAYMENT_BATCH"');
    expect(templateCode).toContain('ApprovalBusinessType.PAYMENT_REQUEST -> PAYMENT_REQUEST');
    expect(templateCode).toContain('ApprovalBusinessType.PAYMENT_BATCH -> PAYMENT_BATCH');
    expect(inboxService).toContain('case ApprovalBusinessType.PAYMENT_REQUEST -> paymentRequestSummary(task)');
    expect(inboxService).toContain('case ApprovalBusinessType.PAYMENT_BATCH -> paymentBatchSummary(task)');
    expect(inboxService).toContain('private ApprovalTaskSummary paymentRequestSummary');
    expect(inboxService).toContain('private ApprovalTaskSummary paymentBatchSummary');
    expect(paymentRequestMigration).toContain('TPL_PAYMENT_REQUEST');
    expect(paymentRequestMigration).toContain('payment_request');
    expect(paymentBatchMigration).toContain('TPL_PAYMENT_BATCH');
    expect(paymentBatchMigration).toContain('payment_batch');
  });

  it('submits payment requests into approval tasks and writes finance audit logs', () => {
    const service = read('backend-java/src/main/java/com/procurement/finance/application/FinanceActionApplicationService.java');
    const statusTest = read('scripts/finance-action-status-flow-ui.test.ts');

    expect(service).toContain('ApprovalTaskApplicationService');
    expect(service).toContain('ApprovalTaskMapper');
    expect(service).toContain('AuditLogApplicationService');
    expect(service).toContain('ApprovalBusinessType.PAYMENT_REQUEST');
    expect(service).toContain('ApprovalBusinessType.PAYMENT_BATCH');
    expect(service).toContain('createPendingTask');
    expect(service).toContain('ensurePaymentBatchApprovalTask');
    expect(service).toContain('approvePendingPaymentBatchTask');
    expect(service).toContain('payment_request.submitted');
    expect(service).toContain('payment_request.approved');
    expect(service).toContain('payment_batch.submitted');
    expect(service).toContain('payment_batch.approved');
    expect(service).toContain('variance_handling.updated');
    expect(service).toContain('AuditTargetType.INVOICE');
    expect(statusTest).toContain('付款申请状态流转');
  });

  it('documents the sixth stage-four increment and keeps the current boundary explicit', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('第六轮');
    expect(checklist).toContain('付款申请审批任务化');
    expect(checklist).toContain('付款批次审批任务化');
    expect(checklist).toContain('差异处理审计留痕');
    expect(checklist).toContain('scripts/finance-approval-audit-flow.test.ts');
    expect(checklist).toContain('尚未接入多级审批、会签和可视化审批流');
  });
});
