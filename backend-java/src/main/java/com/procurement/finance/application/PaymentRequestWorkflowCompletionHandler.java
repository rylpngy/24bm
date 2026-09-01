package com.procurement.finance.application;

import com.procurement.approval.domain.ApprovalBusinessType;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.domain.AuditTargetType;
import com.procurement.finance.domain.PaymentRequest;
import com.procurement.finance.domain.PaymentBatch;
import com.procurement.finance.domain.PaymentBatchStatus;
import com.procurement.finance.infrastructure.PaymentBatchMapper;
import com.procurement.finance.infrastructure.PaymentExecutionRecordMapper;
import com.procurement.finance.infrastructure.PaymentRequestMapper;
import com.procurement.workflow.application.WorkflowBusinessCompletionHandler;
import com.procurement.workflow.application.WorkflowCompletion;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class PaymentRequestWorkflowCompletionHandler implements WorkflowBusinessCompletionHandler {
  private final PaymentRequestMapper paymentRequestMapper;
  private final PaymentBatchMapper paymentBatchMapper;
  private final PaymentExecutionRecordMapper paymentExecutionRecordMapper;
  private final AuditLogApplicationService auditLogApplicationService;

  public PaymentRequestWorkflowCompletionHandler(
      PaymentRequestMapper paymentRequestMapper,
      PaymentBatchMapper paymentBatchMapper,
      PaymentExecutionRecordMapper paymentExecutionRecordMapper,
      AuditLogApplicationService auditLogApplicationService) {
    this.paymentRequestMapper = paymentRequestMapper;
    this.paymentBatchMapper = paymentBatchMapper;
    this.paymentExecutionRecordMapper = paymentExecutionRecordMapper;
    this.auditLogApplicationService = auditLogApplicationService;
  }

  @Override
  public String businessType() {
    return ApprovalBusinessType.PAYMENT_REQUEST;
  }

  @Override
  public void onCompleted(WorkflowBusinessInstance instance, WorkflowCompletion completion) {
    PaymentRequest request = paymentRequestMapper.findByTenantAndId(instance.tenantId(), instance.businessId());
    if (request == null || !"付款申请审批中".equals(request.requestStatus())) {
      throw new IllegalStateException("Payment request is not awaiting workflow approval: " + instance.businessId());
    }
    PaymentBatch paymentBatch = paymentBatchMapper.findByTenantAndPaymentBatchNo(
        instance.tenantId(), request.paymentBatchNo());
    if (paymentBatch != null && !PaymentBatchStatus.acceptsPaymentRequestChanges(paymentBatch.batchStatus())) {
      throw new IllegalStateException(
          "Payment batch cannot be changed after batch approval has started: " + request.paymentBatchNo());
    }
    String targetStatus = completion.approved() ? "付款申请已通过" : "付款申请已驳回";
    paymentRequestMapper.updateStatus(instance.tenantId(), request.id(), targetStatus);
    paymentBatchMapper.upsertFromPaymentRequests(
        "paybatch-" + UUID.randomUUID(), instance.tenantId(), request.paymentBatchNo());
    paymentExecutionRecordMapper.upsertFromPaymentRequest(
        "payexec-" + UUID.randomUUID(), instance.tenantId(), request.id());
    auditLogApplicationService.recordTenantAction(
        instance.tenantId(),
        completion.approved() ? "payment_request.approved" : "payment_request.rejected",
        AuditTargetType.INVOICE,
        request.invoiceId(),
        completion.comment());
  }
}
