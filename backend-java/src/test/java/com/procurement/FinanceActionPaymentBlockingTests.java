package com.procurement;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.approval.domain.ApprovalBusinessType;
import com.procurement.approval.domain.ApprovalStatus;
import com.procurement.approval.domain.ApprovalTask;
import com.procurement.approval.application.ApprovalTaskApplicationService;
import com.procurement.approval.infrastructure.ApprovalTaskMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.finance.api.CreatePaymentArchiveExceptionRequestRequest;
import com.procurement.finance.api.CreatePaymentRequestRequest;
import com.procurement.finance.api.CompletePaymentArchiveExceptionActionRequest;
import com.procurement.finance.api.ClosePaymentArchiveExceptionRequestRequest;
import com.procurement.finance.api.ReviewPaymentArchiveExceptionRequest;
import com.procurement.finance.api.UpdatePaymentBatchStatusRequest;
import com.procurement.finance.api.UpdatePaymentRequestStatusRequest;
import com.procurement.finance.api.UpdateVarianceHandlingStatusRequest;
import com.procurement.finance.application.FinanceActionApplicationService;
import com.procurement.finance.application.PaymentApplicationService;
import com.procurement.finance.domain.Invoice;
import com.procurement.finance.domain.PaymentArchiveExceptionRequest;
import com.procurement.finance.domain.PaymentBatch;
import com.procurement.finance.domain.PaymentExecutionRecord;
import com.procurement.finance.domain.PaymentRequest;
import com.procurement.finance.domain.ThreeWayMatch;
import com.procurement.finance.domain.VarianceHandling;
import com.procurement.finance.infrastructure.InvoiceMapper;
import com.procurement.finance.infrastructure.PaymentBatchMapper;
import com.procurement.finance.infrastructure.PaymentArchiveExceptionRequestMapper;
import com.procurement.finance.infrastructure.PaymentBlockResolutionMapper;
import com.procurement.finance.infrastructure.PaymentExecutionRecordMapper;
import com.procurement.finance.infrastructure.PaymentRequestMapper;
import com.procurement.finance.infrastructure.ThreeWayMatchMapper;
import com.procurement.finance.infrastructure.VarianceHandlingMapper;
import com.procurement.order.infrastructure.PurchaseOrderMapper;
import com.procurement.tenant.application.TenantFeatureApplicationService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class FinanceActionPaymentBlockingTests {
  private final InvoiceMapper invoiceMapper = org.mockito.Mockito.mock(InvoiceMapper.class);
  private final PurchaseOrderMapper purchaseOrderMapper = org.mockito.Mockito.mock(PurchaseOrderMapper.class);
  private final PaymentBatchMapper paymentBatchMapper = org.mockito.Mockito.mock(PaymentBatchMapper.class);
  private final PaymentArchiveExceptionRequestMapper paymentArchiveExceptionRequestMapper =
      org.mockito.Mockito.mock(PaymentArchiveExceptionRequestMapper.class);
  private final PaymentBlockResolutionMapper paymentBlockResolutionMapper =
      org.mockito.Mockito.mock(PaymentBlockResolutionMapper.class);
  private final PaymentExecutionRecordMapper paymentExecutionRecordMapper =
      org.mockito.Mockito.mock(PaymentExecutionRecordMapper.class);
  private final PaymentRequestMapper paymentRequestMapper = org.mockito.Mockito.mock(PaymentRequestMapper.class);
  private final ThreeWayMatchMapper threeWayMatchMapper = org.mockito.Mockito.mock(ThreeWayMatchMapper.class);
  private final VarianceHandlingMapper varianceHandlingMapper = org.mockito.Mockito.mock(VarianceHandlingMapper.class);
  private final PaymentApplicationService paymentApplicationService =
      org.mockito.Mockito.mock(PaymentApplicationService.class);
  private final ApprovalTaskApplicationService approvalTaskApplicationService =
      org.mockito.Mockito.mock(ApprovalTaskApplicationService.class);
  private final ApprovalTaskMapper approvalTaskMapper = org.mockito.Mockito.mock(ApprovalTaskMapper.class);
  private final AuditLogApplicationService auditLogApplicationService =
      org.mockito.Mockito.mock(AuditLogApplicationService.class);
  private final TenantFeatureApplicationService tenantFeatureApplicationService =
      org.mockito.Mockito.mock(TenantFeatureApplicationService.class);
  private final FinanceActionApplicationService financeActionApplicationService =
      new FinanceActionApplicationService(
          invoiceMapper,
          purchaseOrderMapper,
          paymentBatchMapper,
          paymentArchiveExceptionRequestMapper,
          paymentBlockResolutionMapper,
          paymentExecutionRecordMapper,
          paymentRequestMapper,
          threeWayMatchMapper,
          varianceHandlingMapper,
          paymentApplicationService,
          approvalTaskApplicationService,
          approvalTaskMapper,
          auditLogApplicationService,
          tenantFeatureApplicationService);

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void creatingPaymentRequestIsBlockedUntilAmountVarianceIsHandled() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(invoiceMapper.findByTenantAndId("tenant-1", "invoice-1"))
        .thenReturn(invoice());
    when(threeWayMatchMapper.listByTenantFiltered("tenant-1", null, null, null, "invoice-1"))
        .thenReturn(List.of(amountVarianceMatch()));
    when(varianceHandlingMapper.findByTenantAndInvoice("tenant-1", "invoice-1"))
        .thenReturn(varianceHandling("待处理"));
    when(paymentRequestMapper.findByTenantAndInvoice("tenant-1", "invoice-1"))
        .thenReturn(null, paymentRequest());

    assertThatThrownBy(() -> financeActionApplicationService.createCurrentTenantPaymentRequest(
        new CreatePaymentRequestRequest(
            "invoice-1",
            "付款申请待提交",
            "PAY-202606",
            "金额差异未处理时不允许发起付款申请")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Amount variance must be handled before payment request");

    verify(paymentRequestMapper, never()).upsert(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString());
  }

  @Test
  void creatingPaymentRequestIsAllowedAfterAmountVarianceIsHandled() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(invoiceMapper.findByTenantAndId("tenant-1", "invoice-1"))
        .thenReturn(invoice());
    when(threeWayMatchMapper.listByTenantFiltered("tenant-1", null, null, null, "invoice-1"))
        .thenReturn(List.of(amountVarianceMatch()));
    when(varianceHandlingMapper.findByTenantAndInvoice("tenant-1", "invoice-1"))
        .thenReturn(varianceHandling("已处理"));
    when(paymentRequestMapper.findByTenantAndInvoice("tenant-1", "invoice-1"))
        .thenReturn(null, paymentRequest());

    var response = financeActionApplicationService.createCurrentTenantPaymentRequest(
        new CreatePaymentRequestRequest(
            "invoice-1",
            "付款申请待提交",
            "PAY-202606",
            "差异已处理后允许发起付款申请"));

    assertThat(response.id()).isEqualTo("payreq-1");
    assertThat(response.requestStatus()).isEqualTo("付款申请待提交");
    verify(paymentRequestMapper).upsert(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("invoice-1"),
        org.mockito.ArgumentMatchers.eq("supplier-1"),
        org.mockito.ArgumentMatchers.eq("po-1"),
        org.mockito.ArgumentMatchers.eq(BigDecimal.valueOf(1200)),
        org.mockito.ArgumentMatchers.eq("付款申请待提交"),
        org.mockito.ArgumentMatchers.eq("PAY-202606"),
        org.mockito.ArgumentMatchers.eq("差异已处理后允许发起付款申请"),
        org.mockito.ArgumentMatchers.eq("buyer-user"));
    verify(paymentBatchMapper).upsertFromPaymentRequests(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("PAY-202606"));
  }

  @Test
  void archivingPaymentBatchIsBlockedUntilAllExecutionRecordsAreRegistered() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(paymentBatchMapper.findByTenantAndPaymentBatchNo("tenant-1", "PAY-202606"))
        .thenReturn(paymentBatch("可安排付款"));
    when(paymentExecutionRecordMapper.summarizeByTenantAndBatch("tenant-1", "PAY-202606"))
        .thenReturn(Map.of(
            "registered_count", 1,
            "pending_registration_count", 1,
            "blocked_registration_count", 0,
            "execution_decision", "可继续登记付款"));

    assertThatThrownBy(() -> financeActionApplicationService.updateCurrentTenantPaymentBatchStatus(
        "PAY-202606",
        new UpdatePaymentBatchStatusRequest("已付款归档")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Payment batch cannot be archived until all execution records are registered");

    verify(paymentBatchMapper, never()).updateStatus(
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("PAY-202606"),
        org.mockito.ArgumentMatchers.eq("已付款归档"));
  }

  @Test
  void approvingPaymentBatchIsBlockedUntilAllPaymentRequestsAreApproved() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(paymentBatchMapper.findByTenantAndPaymentBatchNo("tenant-1", "PAY-202606"))
        .thenReturn(paymentBatch("审批中", BigDecimal.valueOf(2400), BigDecimal.valueOf(1200)));

    assertThatThrownBy(() -> financeActionApplicationService.updateCurrentTenantPaymentBatchStatus(
        "PAY-202606",
        new UpdatePaymentBatchStatusRequest("可安排付款")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Payment batch cannot be approved until all payment requests are approved");

    verify(paymentBatchMapper, never()).updateStatus(
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("PAY-202606"),
        org.mockito.ArgumentMatchers.eq("可安排付款"));
    verify(auditLogApplicationService, never()).recordTenantAction(
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("payment_batch.approved"),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.eq("PAY-202606"));
  }

  @Test
  void archivingPaymentBatchRecordsExecutionSummaryAudit() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(paymentBatchMapper.findByTenantAndPaymentBatchNo("tenant-1", "PAY-202606"))
        .thenReturn(paymentBatch("可安排付款"), paymentBatch("已付款归档"));
    when(paymentExecutionRecordMapper.summarizeByTenantAndBatch("tenant-1", "PAY-202606"))
        .thenReturn(Map.of(
            "registered_amount", BigDecimal.valueOf(2400),
            "registered_count", 2,
            "pending_registration_count", 0,
            "blocked_registration_count", 0,
            "execution_decision", "批次付款已登记"));

    var response = financeActionApplicationService.updateCurrentTenantPaymentBatchStatus(
        "PAY-202606",
        new UpdatePaymentBatchStatusRequest("已付款归档"));

    assertThat(response.batchStatus()).isEqualTo("已付款归档");
    verify(auditLogApplicationService).recordTenantAction(
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("payment_batch.archived|registered=2|amount=2400|decision=批次付款已登记"),
        org.mockito.ArgumentMatchers.eq("payment_batch"),
        org.mockito.ArgumentMatchers.eq("PAY-202606"));
  }

  @Test
  void archivedPaymentBatchFreezesPaymentRequestExecutionAndVarianceMutations() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(paymentBatchMapper.findByTenantAndPaymentBatchNo("tenant-1", "PAY-202606"))
        .thenReturn(paymentBatch("已付款归档"));
    when(paymentRequestMapper.findByTenantAndId("tenant-1", "payreq-1"))
        .thenReturn(paymentRequest());
    when(paymentExecutionRecordMapper.findByTenantAndId("tenant-1", "payexec-1"))
        .thenReturn(paymentExecutionRecord("待登记付款"));
    when(varianceHandlingMapper.findByTenantAndId("tenant-1", "variance-1"))
        .thenReturn(varianceHandling("待处理"));
    when(paymentRequestMapper.findByTenantAndInvoice("tenant-1", "invoice-1"))
        .thenReturn(paymentRequest());

    assertThatThrownBy(() -> financeActionApplicationService.updateCurrentTenantPaymentRequestStatus(
        "payreq-1",
        new UpdatePaymentRequestStatusRequest("付款申请已通过")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Payment batch is archived and can only be audited");
    assertThatThrownBy(() -> financeActionApplicationService.registerCurrentTenantPaymentExecutionRecord("payexec-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Payment batch is archived and can only be audited");
    assertThatThrownBy(() -> financeActionApplicationService.updateCurrentTenantVarianceHandlingStatus(
        "variance-1",
        new UpdateVarianceHandlingStatusRequest("已处理", "归档后不允许再处理差异")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Payment batch is archived and can only be audited");

    verify(paymentRequestMapper, never()).updateStatus(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString());
    verify(paymentApplicationService, never()).register(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.any());
    verify(varianceHandlingMapper, never()).updateStatus(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString());
  }

  @Test
  void updatingPaymentRequestStatusIsBlockedAfterPaymentExecutionRegistered() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(paymentRequestMapper.findByTenantAndId("tenant-1", "payreq-1"))
        .thenReturn(paymentRequest());
    when(paymentBatchMapper.findByTenantAndPaymentBatchNo("tenant-1", "PAY-202606"))
        .thenReturn(paymentBatch("可安排付款"));
    when(paymentExecutionRecordMapper.listByTenantFiltered(
        "tenant-1",
        "PAY-202606",
        "已登记付款",
        "supplier-1",
        "invoice-1"))
        .thenReturn(List.of(paymentExecutionRecord("已登记付款")));

    assertThatThrownBy(() -> financeActionApplicationService.updateCurrentTenantPaymentRequestStatus(
        "payreq-1",
        new UpdatePaymentRequestStatusRequest("付款申请审批中")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Payment request already has registered execution");

    verify(paymentRequestMapper, never()).updateStatus(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString());
    verify(paymentExecutionRecordMapper, never()).upsertFromPaymentRequest(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString());
  }

  @Test
  void recreatingPaymentRequestIsBlockedAfterPaymentExecutionRegistered() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(invoiceMapper.findByTenantAndId("tenant-1", "invoice-1"))
        .thenReturn(invoice());
    when(threeWayMatchMapper.listByTenantFiltered("tenant-1", null, null, null, "invoice-1"))
        .thenReturn(List.of());
    when(paymentRequestMapper.findByTenantAndInvoice("tenant-1", "invoice-1"))
        .thenReturn(paymentRequest());
    when(paymentBatchMapper.findByTenantAndPaymentBatchNo("tenant-1", "PAY-202606"))
        .thenReturn(paymentBatch("可安排付款"));
    when(paymentExecutionRecordMapper.listByTenantFiltered(
        "tenant-1",
        "PAY-202606",
        "已登记付款",
        "supplier-1",
        "invoice-1"))
        .thenReturn(List.of(paymentExecutionRecord("已登记付款")));

    assertThatThrownBy(() -> financeActionApplicationService.createCurrentTenantPaymentRequest(
        new CreatePaymentRequestRequest(
            "invoice-1",
            "付款申请待提交",
            "PAY-202607",
            "付款执行后不允许重新覆盖申请")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Payment request already has registered execution");

    verify(paymentRequestMapper, never()).upsert(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString());
  }

  @Test
  void archiveExceptionRequestRequiresArchivedPaymentBatch() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(paymentBatchMapper.findByTenantAndPaymentBatchNo("tenant-1", "PAY-202606"))
        .thenReturn(paymentBatch("可安排付款"));

    assertThatThrownBy(() -> financeActionApplicationService.createCurrentTenantPaymentArchiveExceptionRequest(
        new CreatePaymentArchiveExceptionRequestRequest(
            "PAY-202606",
            "撤销申请",
            "批次尚未归档时不允许提交归档异常申请")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Payment archive exception request requires archived batch");

    verify(paymentArchiveExceptionRequestMapper, never()).upsert(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString());
  }

  @Test
  void archiveExceptionRequestIsSavedForArchivedPaymentBatchAndAudited() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(paymentBatchMapper.findByTenantAndPaymentBatchNo("tenant-1", "PAY-202606"))
        .thenReturn(paymentBatch("已付款归档"));
    when(paymentArchiveExceptionRequestMapper.findByTenantAndNaturalKey(
        "tenant-1",
        "PAY-202606",
        "撤销申请",
        "待审批"))
        .thenReturn(paymentArchiveExceptionRequest());

    var response = financeActionApplicationService.createCurrentTenantPaymentArchiveExceptionRequest(
        new CreatePaymentArchiveExceptionRequestRequest(
            "PAY-202606",
            "撤销申请",
            "归档后发现付款登记金额异常，提交撤销申请进入审批"));

    assertThat(response.paymentBatchNo()).isEqualTo("PAY-202606");
    assertThat(response.exceptionType()).isEqualTo("撤销申请");
    assertThat(response.approvalStatus()).isEqualTo("待审批");
    verify(paymentArchiveExceptionRequestMapper).upsert(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("PAY-202606"),
        org.mockito.ArgumentMatchers.eq("撤销申请"),
        org.mockito.ArgumentMatchers.eq("归档后发现付款登记金额异常，提交撤销申请进入审批"),
        org.mockito.ArgumentMatchers.eq("待审批"),
        org.mockito.ArgumentMatchers.eq("buyer-user"));
    verify(auditLogApplicationService).recordTenantAction(
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("payment_archive_exception.requested"),
        org.mockito.ArgumentMatchers.eq("payment_batch"),
        org.mockito.ArgumentMatchers.eq("PAY-202606"));
    verify(approvalTaskApplicationService).createPendingTask(
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq(ApprovalBusinessType.PAYMENT_ARCHIVE_EXCEPTION),
        org.mockito.ArgumentMatchers.eq("payarchive-exception-1"),
        org.mockito.ArgumentMatchers.isNull());
  }

  @Test
  void archiveExceptionReviewUpdatesApprovalTaskAndRequestStatusWithoutUnfreezingBatch() {
    TenantContext.set("tenant-1", null, "finance-approver");
    when(paymentArchiveExceptionRequestMapper.findByTenantAndId("tenant-1", "payarchive-exception-1"))
        .thenReturn(paymentArchiveExceptionRequest(), paymentArchiveExceptionRequest("已通过", "finance-approver"));
    when(approvalTaskMapper.findPendingByBiz(
        "tenant-1",
        ApprovalBusinessType.PAYMENT_ARCHIVE_EXCEPTION,
        "payarchive-exception-1",
        ApprovalStatus.PENDING))
        .thenReturn(approvalTask("approval-archive-exception-1", "待审批"));
    when(approvalTaskMapper.updateStatus(
        "tenant-1",
        "approval-archive-exception-1",
        ApprovalStatus.PENDING,
        ApprovalStatus.APPROVED,
        "finance-approver",
        null))
        .thenReturn(1);
    when(approvalTaskMapper.findByTenantAndId("tenant-1", "approval-archive-exception-1"))
        .thenReturn(approvalTask("approval-archive-exception-1", "已通过"));
    when(paymentArchiveExceptionRequestMapper.updateApprovalStatus(
        "tenant-1",
        "payarchive-exception-1",
        "待审批",
        "已通过",
        "finance-approver"))
        .thenReturn(1);

    var response = financeActionApplicationService.reviewCurrentTenantPaymentArchiveExceptionRequest(
        "payarchive-exception-1",
        new ReviewPaymentArchiveExceptionRequest(true));

    assertThat(response.status()).isEqualTo("已通过");
    verify(paymentArchiveExceptionRequestMapper).updateApprovalStatus(
        "tenant-1",
        "payarchive-exception-1",
        "待审批",
        "已通过",
        "finance-approver");
    verify(auditLogApplicationService).recordTenantAction(
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("payment_archive_exception.approved"),
        org.mockito.ArgumentMatchers.eq("payment_batch"),
        org.mockito.ArgumentMatchers.eq("PAY-202606"));
    verify(paymentBatchMapper, never()).updateStatus(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString());
  }

  @Test
  void approvedArchiveExceptionCanRegisterControlledActionWithoutUnfreezingBatch() {
    TenantContext.set("tenant-1", null, "finance-handler");
    when(paymentArchiveExceptionRequestMapper.findByTenantAndId("tenant-1", "payarchive-exception-1"))
        .thenReturn(paymentArchiveExceptionRequest("已通过", "finance-approver"),
            paymentArchiveExceptionRequest("已通过", "finance-approver", "已登记受控处理", "已确认撤销申请，等待后续专用解冻流程。", "finance-handler"));
    when(paymentArchiveExceptionRequestMapper.updateActionStatus(
        "tenant-1",
        "payarchive-exception-1",
        "已登记受控处理",
        "已确认撤销申请，等待后续专用解冻流程。",
        "finance-handler"))
        .thenReturn(1);

    var response = financeActionApplicationService.completeCurrentTenantPaymentArchiveExceptionAction(
        "payarchive-exception-1",
        new CompletePaymentArchiveExceptionActionRequest("已确认撤销申请，等待后续专用解冻流程。"));

    assertThat(response.actionStatus()).isEqualTo("已登记受控处理");
    assertThat(response.handledBy()).isEqualTo("finance-handler");
    verify(paymentArchiveExceptionRequestMapper).updateActionStatus(
        "tenant-1",
        "payarchive-exception-1",
        "已登记受控处理",
        "已确认撤销申请，等待后续专用解冻流程。",
        "finance-handler");
    verify(auditLogApplicationService).recordTenantAction(
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("payment_archive_exception.action_completed"),
        org.mockito.ArgumentMatchers.eq("payment_batch"),
        org.mockito.ArgumentMatchers.eq("PAY-202606"));
    verify(paymentBatchMapper, never()).updateStatus(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString());
  }

  @Test
  void completedArchiveExceptionActionCanBeClosedWithoutUnfreezingBatch() {
    TenantContext.set("tenant-1", null, "finance-closer");
    when(paymentArchiveExceptionRequestMapper.findByTenantAndId("tenant-1", "payarchive-exception-1"))
        .thenReturn(
            paymentArchiveExceptionRequest(
                "已通过",
                "finance-approver",
                "已登记受控处理",
                "已确认撤销申请，等待后续专用解冻流程。",
                "finance-handler",
                "待关闭",
                null,
                null),
            paymentArchiveExceptionRequest(
                "已通过",
                "finance-approver",
                "已登记受控处理",
                "已确认撤销申请，等待后续专用解冻流程。",
                "finance-handler",
                "已关闭",
                "复核已完成，归档异常申请关闭；后续如需解冻另走专用流程。",
                "finance-closer"));
    when(paymentArchiveExceptionRequestMapper.updateClosureStatus(
        "tenant-1",
        "payarchive-exception-1",
        "已关闭",
        "复核已完成，归档异常申请关闭；后续如需解冻另走专用流程。",
        "finance-closer"))
        .thenReturn(1);

    var response = financeActionApplicationService.closeCurrentTenantPaymentArchiveExceptionRequest(
        "payarchive-exception-1",
        new ClosePaymentArchiveExceptionRequestRequest("复核已完成，归档异常申请关闭；后续如需解冻另走专用流程。"));

    assertThat(response.closureStatus()).isEqualTo("已关闭");
    assertThat(response.closedBy()).isEqualTo("finance-closer");
    verify(paymentArchiveExceptionRequestMapper).updateClosureStatus(
        "tenant-1",
        "payarchive-exception-1",
        "已关闭",
        "复核已完成，归档异常申请关闭；后续如需解冻另走专用流程。",
        "finance-closer");
    verify(auditLogApplicationService).recordTenantAction(
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("payment_archive_exception.closed"),
        org.mockito.ArgumentMatchers.eq("payment_batch"),
        org.mockito.ArgumentMatchers.eq("PAY-202606"));
    verify(paymentBatchMapper, never()).updateStatus(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString());
  }

  @Test
  void lineThreeWayMatchFlagsAmountVarianceShortfallAndUninvoicedPerLine() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(invoiceMapper.findByTenantAndId("tenant-1", "invoice-1")).thenReturn(invoice());
    when(threeWayMatchMapper.listLineReconciliation("tenant-1", "po-1", "invoice-1"))
        .thenReturn(java.util.List.of(
            // 金额差异:发票行金额 50000 > 订单行金额 48000。
            new com.procurement.finance.domain.ThreeWayMatchLineRow(
                "oli-a", "网络机柜", "台", BigDecimal.valueOf(4), BigDecimal.valueOf(12000),
                BigDecimal.valueOf(48000), BigDecimal.valueOf(4), BigDecimal.valueOf(4),
                BigDecimal.valueOf(4), BigDecimal.valueOf(12500), BigDecimal.valueOf(50000)),
            // 数量短缺:合格 1995 < 订购 2000,金额一致。
            new com.procurement.finance.domain.ThreeWayMatchLineRow(
                "oli-b", "综合布线", "米", BigDecimal.valueOf(2000), BigDecimal.valueOf(20),
                BigDecimal.valueOf(40000), BigDecimal.valueOf(2000), BigDecimal.valueOf(1995),
                BigDecimal.valueOf(2000), BigDecimal.valueOf(20), BigDecimal.valueOf(40000)),
            // 未开票:无发票行项。
            new com.procurement.finance.domain.ThreeWayMatchLineRow(
                "oli-c", "理线架", "个", BigDecimal.valueOf(10), BigDecimal.valueOf(100),
                BigDecimal.valueOf(1000), BigDecimal.valueOf(10), BigDecimal.valueOf(10),
                null, null, null)));

    var lines = financeActionApplicationService.listCurrentTenantThreeWayMatchLines("invoice-1");

    org.assertj.core.api.Assertions.assertThat(lines).hasSize(3);
    org.assertj.core.api.Assertions.assertThat(lines.get(0).lineMatchStatus()).isEqualTo("金额差异");
    org.assertj.core.api.Assertions.assertThat(lines.get(0).amountVariance()).isEqualByComparingTo("2000");
    org.assertj.core.api.Assertions.assertThat(lines.get(1).lineMatchStatus()).isEqualTo("数量短缺");
    org.assertj.core.api.Assertions.assertThat(lines.get(2).lineMatchStatus()).isEqualTo("未开票");
  }

  private Invoice invoice() {
    return new Invoice(
        "invoice-1",
        "tenant-1",
        "supplier-1",
        "po-1",
        BigDecimal.valueOf(1200),
        "INV-001",
        "待付款",
        null,
        OffsetDateTime.now(),
        OffsetDateTime.now(), "144031909110", java.time.LocalDate.parse("2026-06-01"), new java.math.BigDecimal("13.00"));
  }

  private PaymentBatch paymentBatch(String batchStatus) {
    return paymentBatch(batchStatus, BigDecimal.valueOf(2400), BigDecimal.valueOf(2400));
  }

  private PaymentBatch paymentBatch(String batchStatus, BigDecimal totalAmount, BigDecimal approvedAmount) {
    return new PaymentBatch(
        "paybatch-1",
        "tenant-1",
        "PAY-202606",
        "supplier-1",
        2,
        totalAmount,
        approvedAmount,
        BigDecimal.valueOf(1200),
        BigDecimal.valueOf(1200),
        BigDecimal.ZERO,
        1,
        1,
        0,
        "可继续登记付款",
        "暂无阻断",
        batchStatus,
        LocalDate.now(),
        OffsetDateTime.now(),
        OffsetDateTime.now());
  }

  private PaymentArchiveExceptionRequest paymentArchiveExceptionRequest() {
    return paymentArchiveExceptionRequest("待审批", null);
  }

  private PaymentArchiveExceptionRequest paymentArchiveExceptionRequest(String approvalStatus, String reviewedBy) {
    return paymentArchiveExceptionRequest(approvalStatus, reviewedBy, "待处理", null, null);
  }

  private PaymentArchiveExceptionRequest paymentArchiveExceptionRequest(
      String approvalStatus,
      String reviewedBy,
      String actionStatus,
      String actionResult,
      String handledBy) {
    return paymentArchiveExceptionRequest(
        approvalStatus,
        reviewedBy,
        actionStatus,
        actionResult,
        handledBy,
        "待关闭",
        null,
        null);
  }

  private PaymentArchiveExceptionRequest paymentArchiveExceptionRequest(
      String approvalStatus,
      String reviewedBy,
      String actionStatus,
      String actionResult,
      String handledBy,
      String closureStatus,
      String closureResult,
      String closedBy) {
    return new PaymentArchiveExceptionRequest(
        "payarchive-exception-1",
        "tenant-1",
        "PAY-202606",
        "撤销申请",
        "归档后发现付款登记金额异常，提交撤销申请进入审批",
        approvalStatus,
        actionStatus,
        actionResult,
        closureStatus,
        closureResult,
        "buyer-user",
        reviewedBy,
        handledBy,
        closedBy,
        OffsetDateTime.now(),
        OffsetDateTime.now());
  }

  private ApprovalTask approvalTask(String id, String status) {
    return new ApprovalTask(
        id,
        "tenant-1",
        ApprovalBusinessType.PAYMENT_ARCHIVE_EXCEPTION,
        "payarchive-exception-1",
        "finance-approver",
        status,
        OffsetDateTime.now(),
        status.equals("待审批") ? null : OffsetDateTime.now());
  }

  private ThreeWayMatch amountVarianceMatch() {
    return new ThreeWayMatch(
        "match-1",
        "tenant-1",
        "invoice-1",
        "supplier-1",
        "po-1",
        BigDecimal.valueOf(1000),
        "已收货",
        BigDecimal.valueOf(1200),
        BigDecimal.valueOf(200),
        "金额差异",
        "发票金额与订单金额不一致",
        "需处理差异",
        OffsetDateTime.now(),
        OffsetDateTime.now());
  }

  private PaymentRequest paymentRequest() {
    return new PaymentRequest(
        "payreq-1",
        "tenant-1",
        "invoice-1",
        "supplier-1",
        "po-1",
        BigDecimal.valueOf(1200),
        "付款申请待提交",
        "PAY-202606",
        "金额差异未处理时不允许发起付款申请",
        "buyer-user",
        OffsetDateTime.now(),
        OffsetDateTime.now());
  }

  private PaymentExecutionRecord paymentExecutionRecord(String executionStatus) {
    return new PaymentExecutionRecord(
        "payexec-1",
        "tenant-1",
        "PAY-202606",
        "payreq-1",
        "invoice-1",
        "supplier-1",
        BigDecimal.valueOf(1200),
        LocalDate.now(),
        executionStatus,
        "等待付款登记",
        null,
        "buyer-user",
        OffsetDateTime.now(),
        OffsetDateTime.now());
  }

  private VarianceHandling varianceHandling(String status) {
    return new VarianceHandling(
        "variance-1",
        "tenant-1",
        "invoice-1",
        "supplier-1",
        "po-1",
        BigDecimal.valueOf(200),
        "发票金额与订单金额不一致",
        "buyer-user",
        "待财务复核",
        status,
        "buyer-user",
        OffsetDateTime.now(),
        OffsetDateTime.now());
  }
}
