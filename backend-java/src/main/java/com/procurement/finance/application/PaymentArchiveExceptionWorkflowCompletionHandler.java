package com.procurement.finance.application;

import com.procurement.approval.domain.ApprovalBusinessType;
import com.procurement.approval.domain.ApprovalStatus;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.domain.AuditTargetType;
import com.procurement.finance.domain.PaymentArchiveExceptionRequest;
import com.procurement.finance.infrastructure.PaymentArchiveExceptionRequestMapper;
import com.procurement.workflow.application.WorkflowBusinessCompletionHandler;
import com.procurement.workflow.application.WorkflowCompletion;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import org.springframework.stereotype.Component;

@Component
public class PaymentArchiveExceptionWorkflowCompletionHandler implements WorkflowBusinessCompletionHandler {
  private final PaymentArchiveExceptionRequestMapper paymentArchiveExceptionRequestMapper;
  private final AuditLogApplicationService auditLogApplicationService;

  public PaymentArchiveExceptionWorkflowCompletionHandler(
      PaymentArchiveExceptionRequestMapper paymentArchiveExceptionRequestMapper,
      AuditLogApplicationService auditLogApplicationService) {
    this.paymentArchiveExceptionRequestMapper = paymentArchiveExceptionRequestMapper;
    this.auditLogApplicationService = auditLogApplicationService;
  }

  @Override
  public String businessType() {
    return ApprovalBusinessType.PAYMENT_ARCHIVE_EXCEPTION;
  }

  @Override
  public void onCompleted(WorkflowBusinessInstance instance, WorkflowCompletion completion) {
    PaymentArchiveExceptionRequest request = paymentArchiveExceptionRequestMapper.findByTenantAndId(
        instance.tenantId(), instance.businessId());
    if (request == null || !ApprovalStatus.PENDING.equals(request.approvalStatus())) {
      throw new IllegalStateException("Payment archive exception is not awaiting workflow approval: " + instance.businessId());
    }
    String next = completion.approved() ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED;
    if (paymentArchiveExceptionRequestMapper.updateApprovalStatus(
        instance.tenantId(), request.id(), ApprovalStatus.PENDING, next, completion.actorId()) == 0) {
      throw new IllegalStateException("Payment archive exception changed before workflow outcome could be applied: " + request.id());
    }
    auditLogApplicationService.recordTenantAction(
        instance.tenantId(),
        completion.approved() ? "payment_archive_exception.approved" : "payment_archive_exception.rejected",
        AuditTargetType.PAYMENT_BATCH,
        request.paymentBatchNo(),
        completion.comment());
  }
}
