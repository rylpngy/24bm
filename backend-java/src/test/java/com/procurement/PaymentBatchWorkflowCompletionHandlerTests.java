package com.procurement;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.approval.domain.ApprovalBusinessType;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.finance.application.PaymentBatchWorkflowCompletionHandler;
import com.procurement.finance.domain.PaymentBatch;
import com.procurement.finance.domain.PaymentBatchStatus;
import com.procurement.finance.infrastructure.PaymentBatchMapper;
import com.procurement.workflow.application.WorkflowCompletion;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import com.procurement.workflow.domain.WorkflowInstanceStatus;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.Test;

class PaymentBatchWorkflowCompletionHandlerTests {
  private final PaymentBatchMapper paymentBatchMapper = org.mockito.Mockito.mock(PaymentBatchMapper.class);
  private final AuditLogApplicationService auditLogApplicationService =
      org.mockito.Mockito.mock(AuditLogApplicationService.class);
  private final PaymentBatchWorkflowCompletionHandler handler = new PaymentBatchWorkflowCompletionHandler(
      paymentBatchMapper, auditLogApplicationService);

  @Test
  void approvalMakesFullyApprovedBatchReadyForPayment() {
    PaymentBatch batch = batch(PaymentBatchStatus.APPROVAL_IN_PROGRESS, new BigDecimal("1500"));
    when(paymentBatchMapper.findByTenantAndPaymentBatchNo("tenant-1", "PAY-202608"))
        .thenReturn(batch);

    handler.onCompleted(workflowInstance(), new WorkflowCompletion(true, "reviewer-1", "资金计划已核验"));

    verify(paymentBatchMapper).updateStatus(
        "tenant-1", "PAY-202608", PaymentBatchStatus.READY_FOR_PAYMENT);
    verify(auditLogApplicationService).recordTenantAction(
        "tenant-1", "payment_batch.approved", "payment_batch", "PAY-202608", "资金计划已核验");
  }

  @Test
  void rejectionReturnsBatchToPendingSubmission() {
    PaymentBatch batch = batch(PaymentBatchStatus.APPROVAL_IN_PROGRESS, new BigDecimal("1500"));
    when(paymentBatchMapper.findByTenantAndPaymentBatchNo("tenant-1", "PAY-202608"))
        .thenReturn(batch);

    handler.onCompleted(workflowInstance(), new WorkflowCompletion(false, "reviewer-1", "付款计划需补充"));

    verify(paymentBatchMapper).updateStatus(
        "tenant-1", "PAY-202608", PaymentBatchStatus.PENDING_APPROVAL);
    verify(auditLogApplicationService).recordTenantAction(
        "tenant-1", "payment_batch.rejected", "payment_batch", "PAY-202608", "付款计划需补充");
  }

  private WorkflowBusinessInstance workflowInstance() {
    OffsetDateTime now = OffsetDateTime.parse("2026-08-26T10:00:00+08:00");
    return new WorkflowBusinessInstance(
        "workflow-1",
        "tenant-1",
        ApprovalBusinessType.PAYMENT_BATCH,
        "PAY-202608",
        "workflow-def-v1",
        "flowable-1",
        WorkflowInstanceStatus.PROCESSING,
        "requester-1",
        "dept-1",
        new BigDecimal("1500"),
        "{}",
        "{}",
        null,
        null,
        now,
        now);
  }

  private PaymentBatch batch(String status, BigDecimal approvedAmount) {
    OffsetDateTime now = OffsetDateTime.parse("2026-08-26T10:00:00+08:00");
    return new PaymentBatch(
        "paybatch-1",
        "tenant-1",
        "PAY-202608",
        "supplier-1",
        1,
        new BigDecimal("1500"),
        approvedAmount,
        BigDecimal.ZERO,
        BigDecimal.ZERO,
        BigDecimal.ZERO,
        0,
        0,
        0,
        "暂无执行记录",
        "暂无阻断",
        status,
        LocalDate.parse("2026-09-25"),
        now,
        now);
  }
}
