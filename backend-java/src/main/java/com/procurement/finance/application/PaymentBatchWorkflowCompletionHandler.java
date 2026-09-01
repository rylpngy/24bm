package com.procurement.finance.application;

import com.procurement.approval.domain.ApprovalBusinessType;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.domain.AuditTargetType;
import com.procurement.finance.domain.PaymentBatch;
import com.procurement.finance.domain.PaymentBatchStatus;
import com.procurement.finance.infrastructure.PaymentBatchMapper;
import com.procurement.workflow.application.WorkflowBusinessCompletionHandler;
import com.procurement.workflow.application.WorkflowCompletion;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import java.math.BigDecimal;
import org.springframework.stereotype.Component;

@Component
public class PaymentBatchWorkflowCompletionHandler implements WorkflowBusinessCompletionHandler {
  private final PaymentBatchMapper paymentBatchMapper;
  private final AuditLogApplicationService auditLogApplicationService;

  public PaymentBatchWorkflowCompletionHandler(
      PaymentBatchMapper paymentBatchMapper,
      AuditLogApplicationService auditLogApplicationService) {
    this.paymentBatchMapper = paymentBatchMapper;
    this.auditLogApplicationService = auditLogApplicationService;
  }

  @Override
  public String businessType() {
    return ApprovalBusinessType.PAYMENT_BATCH;
  }

  @Override
  public void onCompleted(WorkflowBusinessInstance instance, WorkflowCompletion completion) {
    PaymentBatch batch = paymentBatchMapper.findByTenantAndPaymentBatchNo(
        instance.tenantId(), instance.businessId());
    if (batch == null || !PaymentBatchStatus.APPROVAL_IN_PROGRESS.equals(batch.batchStatus())) {
      throw new IllegalStateException("Payment batch is not awaiting workflow approval: " + instance.businessId());
    }
    if (completion.approved()) {
      BigDecimal totalAmount = batch.totalAmount() == null ? BigDecimal.ZERO : batch.totalAmount();
      BigDecimal approvedAmount = batch.approvedAmount() == null ? BigDecimal.ZERO : batch.approvedAmount();
      if (batch.requestCount() == null
          || batch.requestCount() <= 0
          || approvedAmount.compareTo(totalAmount) < 0) {
        throw new IllegalStateException(
            "Payment batch cannot be approved until all payment requests are approved: "
                + batch.paymentBatchNo());
      }
    }
    paymentBatchMapper.updateStatus(
        instance.tenantId(), batch.paymentBatchNo(), completion.approved()
            ? PaymentBatchStatus.READY_FOR_PAYMENT
            : PaymentBatchStatus.PENDING_APPROVAL);
    auditLogApplicationService.recordTenantAction(
        instance.tenantId(),
        completion.approved() ? "payment_batch.approved" : "payment_batch.rejected",
        AuditTargetType.PAYMENT_BATCH,
        batch.paymentBatchNo(),
        completion.comment());
  }
}
