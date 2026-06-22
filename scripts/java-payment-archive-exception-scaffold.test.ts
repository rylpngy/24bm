import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('Java payment archive exception request scaffold', () => {
  it('adds a tenant-scoped archive exception request ledger in Java', () => {
    expect(existsSync('backend-java/src/main/resources/db/migration/V110__payment_archive_exception_requests.sql')).toBe(true);
    expect(existsSync('backend-java/src/main/resources/db/migration/V112__payment_archive_exception_action_status.sql')).toBe(true);
    expect(existsSync('backend-java/src/main/resources/db/migration/V113__payment_archive_exception_closure_status.sql')).toBe(true);

    const migration = read('backend-java/src/main/resources/db/migration/V110__payment_archive_exception_requests.sql');
    const actionMigration = read('backend-java/src/main/resources/db/migration/V112__payment_archive_exception_action_status.sql');
    const closureMigration = read('backend-java/src/main/resources/db/migration/V113__payment_archive_exception_closure_status.sql');
    const domain = read('backend-java/src/main/java/com/procurement/finance/domain/PaymentArchiveExceptionRequest.java');
    const mapper = read('backend-java/src/main/java/com/procurement/finance/infrastructure/PaymentArchiveExceptionRequestMapper.java');
    const response = read('backend-java/src/main/java/com/procurement/finance/api/PaymentArchiveExceptionRequestResponse.java');
    const createRequest = read('backend-java/src/main/java/com/procurement/finance/api/CreatePaymentArchiveExceptionRequestRequest.java');
    const service = read('backend-java/src/main/java/com/procurement/finance/application/FinanceActionApplicationService.java');
    const controller = read('backend-java/src/main/java/com/procurement/finance/api/BuyerFinanceActionController.java');
    const approvalBusinessType = read('backend-java/src/main/java/com/procurement/approval/domain/ApprovalBusinessType.java');
    const approvalTemplateCode = read('backend-java/src/main/java/com/procurement/approval/domain/ApprovalTemplateCode.java');
    const approvalInbox = read('backend-java/src/main/java/com/procurement/approval/application/ApprovalInboxApplicationService.java');

    expect(migration).toContain('create table payment_archive_exception_requests');
    expect(migration).toContain('tenant_id varchar(64) not null');
    expect(migration).toContain('payment_batch_no varchar(64) not null');
    expect(migration).toContain('exception_type varchar(64) not null');
    expect(migration).toContain('exception_reason varchar(512) not null');
    expect(migration).toContain('approval_status varchar(64) not null');
    expect(migration).toContain('requested_by varchar(64) not null');
    expect(migration).toContain('unique (tenant_id, payment_batch_no, exception_type, approval_status)');
    expect(actionMigration).toContain('action_status');
    expect(actionMigration).toContain('action_result');
    expect(actionMigration).toContain('handled_by');
    expect(closureMigration).toContain('closure_status');
    expect(closureMigration).toContain('closure_result');
    expect(closureMigration).toContain('closed_by');

    expect(domain).toContain('record PaymentArchiveExceptionRequest');
    expect(domain).toContain('String exceptionType');
    expect(domain).toContain('String exceptionReason');
    expect(domain).toContain('String approvalStatus');
    expect(domain).toContain('String actionStatus');
    expect(domain).toContain('String actionResult');
    expect(domain).toContain('String handledBy');
    expect(domain).toContain('String closureStatus');
    expect(domain).toContain('String closureResult');
    expect(domain).toContain('String closedBy');

    expect(mapper).toContain('listByTenantFiltered');
    expect(mapper).toContain('insert into payment_archive_exception_requests');
    expect(mapper).toContain('findByTenantAndNaturalKey');
    expect(mapper).toContain('updateActionStatus');
    expect(mapper).toContain('updateClosureStatus');
    expect(mapper).toContain(
      'approval_status, action_status, action_result, closure_status, closure_result, requested_by, reviewed_by, handled_by, closed_by',
    );

    expect(response).toContain('record PaymentArchiveExceptionRequestResponse');
    expect(response).toContain('String actionStatus');
    expect(response).toContain('String closureStatus');
    expect(createRequest).toContain('record CreatePaymentArchiveExceptionRequestRequest');
    expect(service).toContain('listCurrentTenantPaymentArchiveExceptionRequests');
    expect(service).toContain('createCurrentTenantPaymentArchiveExceptionRequest');
    expect(service).toContain('reviewCurrentTenantPaymentArchiveExceptionRequest');
    expect(service).toContain('completeCurrentTenantPaymentArchiveExceptionAction');
    expect(service).toContain('closeCurrentTenantPaymentArchiveExceptionRequest');
    expect(service).toContain('requirePaymentBatchArchived');
    expect(service).toContain('ensurePaymentArchiveExceptionApprovalTask');
    expect(mapper).toContain('updateApprovalStatus');
    expect(service).toContain('payment_archive_exception.requested');
    expect(service).toContain('payment_archive_exception.approved');
    expect(service).toContain('payment_archive_exception.rejected');
    expect(service).toContain('payment_archive_exception.action_completed');
    expect(service).toContain('payment_archive_exception.closed');
    expect(controller).toContain('@GetMapping("/payment-archive-exception-requests")');
    expect(controller).toContain('@PostMapping("/payment-archive-exception-requests")');
    expect(controller).toContain('@PostMapping("/payment-archive-exception-requests/{requestId}/approval")');
    expect(controller).toContain('@PostMapping("/payment-archive-exception-requests/{requestId}/controlled-action")');
    expect(controller).toContain('@PostMapping("/payment-archive-exception-requests/{requestId}/closure")');
    expect(approvalBusinessType).toContain('PAYMENT_ARCHIVE_EXCEPTION = "payment_archive_exception"');
    expect(approvalTemplateCode).toContain('PAYMENT_ARCHIVE_EXCEPTION = "TPL_PAYMENT_ARCHIVE_EXCEPTION"');
    expect(approvalInbox).toContain('paymentArchiveExceptionSummary');
    expect(approvalInbox).toContain('付款归档异常 ');
  });

  it('records the archive exception stage-four finance increments in the checklist', () => {
    const checklist = read('docs/stage-four-finance-deepening-checklist.md');

    expect(checklist).toContain('| 83 | 付款归档异常申请 Java 台账 |');
    expect(checklist).toContain('第83轮已新增付款归档异常申请 Java 台账');
    expect(checklist).toContain('| 85 | 付款归档异常申请审批任务化 |');
    expect(checklist).toContain('第85轮已将付款归档异常申请接入审批中心');
    expect(checklist).toContain('| 86 | 付款归档异常审批结果回写 |');
    expect(checklist).toContain('第86轮已将付款归档异常审批结果回写到申请台账');
    expect(checklist).toContain('| 87 | 付款归档异常受控处理入口 |');
    expect(checklist).toContain('第87轮已新增付款归档异常受控处理入口');
    expect(checklist).toContain('| 88 | 付款归档异常关闭复核 |');
    expect(checklist).toContain('第88轮已新增付款归档异常关闭复核');
    expect(checklist).toContain('| 89 | 付款归档异常 Java smoke 闭环 |');
    expect(checklist).toContain('第89轮已将付款归档异常申请闭环纳入 Java smoke');
    expect(checklist).toContain('| 90 | 付款归档异常收口复盘 |');
    expect(checklist).toContain('第90轮已完成付款归档异常申请链路收口复盘');
    expect(checklist).toContain('scripts/java-payment-archive-exception-scaffold.test.ts');
  });
});
