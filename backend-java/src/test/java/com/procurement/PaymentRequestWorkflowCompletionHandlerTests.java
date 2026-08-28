package com.procurement;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.approval.domain.ApprovalBusinessType;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.finance.application.PaymentRequestWorkflowCompletionHandler;
import com.procurement.finance.domain.PaymentBatch;
import com.procurement.finance.domain.PaymentBatchStatus;
import com.procurement.finance.domain.PaymentRequest;
import com.procurement.finance.infrastructure.PaymentBatchMapper;
import com.procurement.finance.infrastructure.PaymentExecutionRecordMapper;
import com.procurement.finance.infrastructure.PaymentRequestMapper;
import com.procurement.workflow.application.WorkflowCompletion;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import com.procurement.workflow.domain.WorkflowInstanceStatus;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.Test;

class PaymentRequestWorkflowCompletionHandlerTests {
  private final PaymentRequestMapper paymentRequestMapper = org.mockito.Mockito.mock(PaymentRequestMapper.class);
  private final PaymentBatchMapper paymentBatchMapper = org.mockito.Mockito.mock(PaymentBatchMapper.class);
  private final PaymentExecutionRecordMapper paymentExecutionRecordMapper =
      org.mockito.Mockito.mock(PaymentExecutionRecordMapper.class);
  private final AuditLogApplicationService auditLogApplicationService =
      org.mockito.Mockito.mock(AuditLogApplicationService.class);
  private final PaymentRequestWorkflowCompletionHandler handler = new PaymentRequestWorkflowCompletionHandler(
      paymentRequestMapper,
      paymentBatchMapper,
      paymentExecutionRecordMapper,
      auditLogApplicationService);

  @Test
  void approvalMarksRequestApprovedAndRefreshesItsBatchAndExecutionRecord() {
    PaymentRequest request = paymentRequest("付款申请审批中");
    when(paymentRequestMapper.findByTenantAndId("tenant-1", request.id())).thenReturn(request);
    when(paymentBatchMapper.findByTenantAndPaymentBatchNo("tenant-1", request.paymentBatchNo()))
        .thenReturn(paymentBatch(PaymentBatchStatus.PAYMENT_REQUEST_IN_PROGRESS));

    handler.onCompleted(workflowInstance(), new WorkflowCompletion(true, "reviewer-1", "付款依据已核验"));

    verify(paymentRequestMapper).updateStatus("tenant-1", request.id(), "付款申请已通过");
    verify(paymentBatchMapper).upsertFromPaymentRequests(anyString(), eq("tenant-1"), eq(request.paymentBatchNo()));
    verify(paymentExecutionRecordMapper).upsertFromPaymentRequest(anyString(), eq("tenant-1"), eq(request.id()));
    verify(auditLogApplicationService).recordTenantAction(
        "tenant-1", "payment_request.approved", "invoice", request.invoiceId(), "付款依据已核验");
  }

  @Test
  void rejectionMarksRequestRejectedAndReturnsBatchToRequestRejectionState() {
    PaymentRequest request = paymentRequest("付款申请审批中");
    when(paymentRequestMapper.findByTenantAndId("tenant-1", request.id())).thenReturn(request);
    when(paymentBatchMapper.findByTenantAndPaymentBatchNo("tenant-1", request.paymentBatchNo()))
        .thenReturn(paymentBatch(PaymentBatchStatus.PAYMENT_REQUEST_IN_PROGRESS));

    handler.onCompleted(workflowInstance(), new WorkflowCompletion(false, "reviewer-1", "付款附件需要补充"));

    verify(paymentRequestMapper).updateStatus("tenant-1", request.id(), "付款申请已驳回");
    verify(paymentBatchMapper).upsertFromPaymentRequests(anyString(), eq("tenant-1"), eq(request.paymentBatchNo()));
    verify(paymentExecutionRecordMapper).upsertFromPaymentRequest(anyString(), eq("tenant-1"), eq(request.id()));
    verify(auditLogApplicationService).recordTenantAction(
        "tenant-1", "payment_request.rejected", "invoice", request.invoiceId(), "付款附件需要补充");
  }

  private WorkflowBusinessInstance workflowInstance() {
    OffsetDateTime now = OffsetDateTime.parse("2026-08-26T10:00:00+08:00");
    return new WorkflowBusinessInstance(
        "workflow-1",
        "tenant-1",
        ApprovalBusinessType.PAYMENT_REQUEST,
        "payreq-1",
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

  private PaymentRequest paymentRequest(String status) {
    OffsetDateTime now = OffsetDateTime.parse("2026-08-26T10:00:00+08:00");
    return new PaymentRequest(
        "payreq-1",
        "tenant-1",
        "invoice-1",
        "supplier-1",
        "order-1",
        new BigDecimal("1500"),
        status,
        "PAY-202608",
        "付款申请",
        "requester-1",
        now,
        now);
  }

  private PaymentBatch paymentBatch(String status) {
    OffsetDateTime now = OffsetDateTime.parse("2026-08-26T10:00:00+08:00");
    return new PaymentBatch(
        "paybatch-1",
        "tenant-1",
        "PAY-202608",
        "supplier-1",
        1,
        new BigDecimal("1500"),
        BigDecimal.ZERO,
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
