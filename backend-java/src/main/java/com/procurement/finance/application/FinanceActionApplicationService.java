package com.procurement.finance.application;

import com.procurement.approval.application.ApprovalTaskApplicationService;
import com.procurement.identity.application.PermissionService;
import com.procurement.approval.domain.ApprovalBusinessType;
import com.procurement.approval.domain.ApprovalStatus;
import com.procurement.approval.domain.ApprovalTask;
import com.procurement.approval.infrastructure.ApprovalTaskMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.domain.AuditTargetType;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.finance.api.ClosePaymentArchiveExceptionRequestRequest;
import com.procurement.finance.api.CompletePaymentArchiveExceptionActionRequest;
import com.procurement.finance.api.CreatePaymentArchiveExceptionRequestRequest;
import com.procurement.finance.api.CreatePaymentRequestRequest;
import com.procurement.finance.api.CreatePaymentBlockResolutionRequest;
import com.procurement.finance.api.CreateVarianceHandlingRequest;
import com.procurement.finance.api.PaymentArchiveExceptionRequestResponse;
import com.procurement.finance.api.PaymentBatchResponse;
import com.procurement.finance.api.PaymentBlockResolutionResponse;
import com.procurement.finance.api.PaymentExecutionRecordResponse;
import com.procurement.finance.api.PaymentRequestResponse;
import com.procurement.finance.api.RegisterPaymentRequest;
import com.procurement.finance.api.ReviewPaymentArchiveExceptionRequest;
import com.procurement.finance.api.ThreeWayMatchLineResponse;
import com.procurement.finance.api.ThreeWayMatchRebuildResponse;
import com.procurement.finance.api.ThreeWayMatchResponse;
import com.procurement.finance.api.UpdatePaymentBatchStatusRequest;
import com.procurement.finance.api.UpdatePaymentBlockResolutionStatusRequest;
import com.procurement.finance.api.UpdatePaymentRequestStatusRequest;
import com.procurement.finance.api.ApproveVarianceHandlingRequest;
import com.procurement.finance.api.FinanceReport;
import com.procurement.finance.infrastructure.FinanceReportRenderer;
import com.procurement.finance.api.UpdateVarianceHandlingStatusRequest;
import com.procurement.finance.api.VarianceHandlingResponse;
import com.procurement.demand.api.ApprovalTaskResponse;
import com.procurement.finance.domain.Invoice;
import com.procurement.finance.domain.PaymentArchiveExceptionRequest;
import com.procurement.finance.domain.PaymentBatch;
import com.procurement.finance.domain.PaymentBlockResolution;
import com.procurement.finance.domain.PaymentExecutionRecord;
import com.procurement.finance.domain.PaymentRequest;
import com.procurement.finance.domain.ThreeWayMatch;
import com.procurement.finance.domain.VarianceApprovalPolicy;
import com.procurement.finance.domain.ThreeWayMatchLineRow;
import com.procurement.finance.domain.VarianceHandling;
import com.procurement.finance.infrastructure.InvoiceMapper;
import com.procurement.finance.infrastructure.PaymentArchiveExceptionRequestMapper;
import com.procurement.finance.infrastructure.PaymentBatchMapper;
import com.procurement.finance.infrastructure.PaymentBlockResolutionMapper;
import com.procurement.finance.infrastructure.PaymentExecutionRecordMapper;
import com.procurement.finance.infrastructure.PaymentRequestMapper;
import com.procurement.finance.infrastructure.ThreeWayMatchMapper;
import com.procurement.finance.infrastructure.VarianceHandlingMapper;
import com.procurement.order.domain.PurchaseOrder;
import com.procurement.order.infrastructure.PurchaseOrderMapper;
import com.procurement.tenant.application.TenantFeatureApplicationService;
import com.procurement.tenant.domain.TenantFeatureKey;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FinanceActionApplicationService {
  private static final String ARCHIVE_EXCEPTION_ACTION_PENDING = "待处理";
  private static final String ARCHIVE_EXCEPTION_ACTION_COMPLETED = "已登记受控处理";
  private static final String ARCHIVE_EXCEPTION_CLOSURE_PENDING = "待关闭";
  private static final String ARCHIVE_EXCEPTION_CLOSURE_CLOSED = "已关闭";

  private final InvoiceMapper invoiceMapper;
  private final PurchaseOrderMapper purchaseOrderMapper;
  private final PaymentBatchMapper paymentBatchMapper;
  private final PaymentArchiveExceptionRequestMapper paymentArchiveExceptionRequestMapper;
  private final PaymentBlockResolutionMapper paymentBlockResolutionMapper;
  private final PaymentExecutionRecordMapper paymentExecutionRecordMapper;
  private final PaymentRequestMapper paymentRequestMapper;
  private final ThreeWayMatchMapper threeWayMatchMapper;
  private final VarianceHandlingMapper varianceHandlingMapper;
  private final PaymentApplicationService paymentApplicationService;
  private final ApprovalTaskApplicationService approvalTaskApplicationService;
  private final ApprovalTaskMapper approvalTaskMapper;
  private final AuditLogApplicationService auditLogApplicationService;
  private final TenantFeatureApplicationService tenantFeatureApplicationService;
  private final PermissionService permissionService;

  public FinanceActionApplicationService(
      InvoiceMapper invoiceMapper,
      PurchaseOrderMapper purchaseOrderMapper,
      PaymentBatchMapper paymentBatchMapper,
      PaymentArchiveExceptionRequestMapper paymentArchiveExceptionRequestMapper,
      PaymentBlockResolutionMapper paymentBlockResolutionMapper,
      PaymentExecutionRecordMapper paymentExecutionRecordMapper,
      PaymentRequestMapper paymentRequestMapper,
      ThreeWayMatchMapper threeWayMatchMapper,
      VarianceHandlingMapper varianceHandlingMapper,
      PaymentApplicationService paymentApplicationService,
      ApprovalTaskApplicationService approvalTaskApplicationService,
      ApprovalTaskMapper approvalTaskMapper,
      AuditLogApplicationService auditLogApplicationService,
      TenantFeatureApplicationService tenantFeatureApplicationService,
      PermissionService permissionService) {
    this.invoiceMapper = invoiceMapper;
    this.purchaseOrderMapper = purchaseOrderMapper;
    this.paymentBatchMapper = paymentBatchMapper;
    this.paymentArchiveExceptionRequestMapper = paymentArchiveExceptionRequestMapper;
    this.paymentBlockResolutionMapper = paymentBlockResolutionMapper;
    this.paymentExecutionRecordMapper = paymentExecutionRecordMapper;
    this.paymentRequestMapper = paymentRequestMapper;
    this.threeWayMatchMapper = threeWayMatchMapper;
    this.varianceHandlingMapper = varianceHandlingMapper;
    this.paymentApplicationService = paymentApplicationService;
    this.approvalTaskApplicationService = approvalTaskApplicationService;
    this.approvalTaskMapper = approvalTaskMapper;
    this.auditLogApplicationService = auditLogApplicationService;
    this.tenantFeatureApplicationService = tenantFeatureApplicationService;
    this.permissionService = permissionService;
  }

  public List<PaymentBatchResponse> listCurrentTenantPaymentBatches(
      String batchStatus,
      String supplierId) {
    String tenantId = TenantAccessGuard.requireTenantId("payment batch APIs");
    paymentExecutionRecordMapper.refreshTenantFromPaymentRequests(tenantId);
    return paymentBatchMapper.listByTenantFiltered(
            tenantId,
            blankToNull(batchStatus),
            blankToNull(supplierId))
        .stream()
        .map(this::toPaymentBatchResponse)
        .toList();
  }

  public List<PaymentBlockResolutionResponse> listCurrentTenantPaymentBlockResolutions(
      String paymentBatchNo,
      String blockReason,
      String resolutionStatus,
      String invoiceId) {
    String tenantId = TenantAccessGuard.requireTenantId("payment block resolution APIs");
    return paymentBlockResolutionMapper.listByTenantFiltered(
            tenantId,
            blankToNull(paymentBatchNo),
            blankToNull(blockReason),
            blankToNull(resolutionStatus),
            blankToNull(invoiceId))
        .stream()
        .map(this::toPaymentBlockResolutionResponse)
        .toList();
  }

  public List<PaymentArchiveExceptionRequestResponse> listCurrentTenantPaymentArchiveExceptionRequests(
      String paymentBatchNo,
      String approvalStatus,
      String exceptionType) {
    String tenantId = TenantAccessGuard.requireTenantId("payment archive exception request APIs");
    return paymentArchiveExceptionRequestMapper.listByTenantFiltered(
            tenantId,
            blankToNull(paymentBatchNo),
            blankToNull(approvalStatus),
            blankToNull(exceptionType))
        .stream()
        .map(this::toPaymentArchiveExceptionRequestResponse)
        .toList();
  }

  @Transactional
  public PaymentArchiveExceptionRequestResponse createCurrentTenantPaymentArchiveExceptionRequest(
      CreatePaymentArchiveExceptionRequestRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("payment archive exception request APIs");
    String userId = TenantAccessGuard.requireUserId("payment archive exception request APIs");
    tenantFeatureApplicationService.requireEnabled(tenantId, TenantFeatureKey.FINANCE);
    requirePaymentBatchArchived(tenantId, request.paymentBatchNo());
    String approvalStatus = ApprovalStatus.PENDING;
    paymentArchiveExceptionRequestMapper.upsert(
        "payarchive-exception-" + UUID.randomUUID(),
        tenantId,
        request.paymentBatchNo(),
        request.exceptionType(),
        request.exceptionReason(),
        approvalStatus,
        userId);
    auditLogApplicationService.recordTenantAction(
        tenantId,
        "payment_archive_exception.requested",
        AuditTargetType.PAYMENT_BATCH,
        request.paymentBatchNo());
    PaymentArchiveExceptionRequest savedRequest = paymentArchiveExceptionRequestMapper.findByTenantAndNaturalKey(
        tenantId,
        request.paymentBatchNo(),
        request.exceptionType(),
        approvalStatus);
    ensurePaymentArchiveExceptionApprovalTask(tenantId, savedRequest);
    return toPaymentArchiveExceptionRequestResponse(savedRequest);
  }

  @Transactional
  public ApprovalTaskResponse reviewCurrentTenantPaymentArchiveExceptionRequest(
      String requestId,
      ReviewPaymentArchiveExceptionRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("payment archive exception request APIs");
    String userId = TenantAccessGuard.requireUserId("payment archive exception request APIs");
    tenantFeatureApplicationService.requireEnabled(tenantId, TenantFeatureKey.FINANCE);
    PaymentArchiveExceptionRequest archiveExceptionRequest =
        paymentArchiveExceptionRequestMapper.findByTenantAndId(tenantId, requestId);
    if (archiveExceptionRequest == null) {
      throw new IllegalArgumentException("Payment archive exception request not found in tenant scope: " + requestId);
    }
    if (!ApprovalStatus.PENDING.equals(archiveExceptionRequest.approvalStatus())) {
      throw new IllegalStateException("Only pending payment archive exception requests can be reviewed: " + requestId);
    }
    ApprovalTask approvalTask = approvalTaskMapper.findPendingByBiz(
        tenantId,
        ApprovalBusinessType.PAYMENT_ARCHIVE_EXCEPTION,
        requestId,
        ApprovalStatus.PENDING);
    if (approvalTask == null) {
      throw new IllegalStateException("Pending approval task not found for payment archive exception request: " + requestId);
    }
    boolean approved = Boolean.TRUE.equals(request.approved());
    String approvalStatus = approved ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED;
    int approvalUpdated = approvalTaskMapper.updateStatus(
        tenantId,
        approvalTask.id(),
        ApprovalStatus.PENDING,
        approvalStatus,
        userId,
        request.comment());
    if (approvalUpdated == 0) {
      throw new IllegalStateException("Approval task status changed before review could be recorded: " + approvalTask.id());
    }
    int requestUpdated = paymentArchiveExceptionRequestMapper.updateApprovalStatus(
        tenantId,
        requestId,
        ApprovalStatus.PENDING,
        approvalStatus,
        userId);
    if (requestUpdated == 0) {
      throw new IllegalStateException("Payment archive exception request status changed before review could be applied: " + requestId);
    }
    auditLogApplicationService.recordTenantAction(
        tenantId,
        approved ? "payment_archive_exception.approved" : "payment_archive_exception.rejected",
        AuditTargetType.PAYMENT_BATCH,
        archiveExceptionRequest.paymentBatchNo());
    ApprovalTask reviewedTask = approvalTaskMapper.findByTenantAndId(tenantId, approvalTask.id());
    return new ApprovalTaskResponse(
        reviewedTask.id(),
        reviewedTask.tenantId(),
        reviewedTask.bizType(),
        reviewedTask.bizId(),
        reviewedTask.assigneeId(),
        reviewedTask.status(),
        reviewedTask.reviewComment(),
        reviewedTask.createdAt());
  }

  @Transactional
  public PaymentArchiveExceptionRequestResponse completeCurrentTenantPaymentArchiveExceptionAction(
      String requestId,
      CompletePaymentArchiveExceptionActionRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("payment archive exception request APIs");
    String userId = TenantAccessGuard.requireUserId("payment archive exception request APIs");
    tenantFeatureApplicationService.requireEnabled(tenantId, TenantFeatureKey.FINANCE);
    PaymentArchiveExceptionRequest archiveExceptionRequest =
        paymentArchiveExceptionRequestMapper.findByTenantAndId(tenantId, requestId);
    if (archiveExceptionRequest == null) {
      throw new IllegalArgumentException("Payment archive exception request not found in tenant scope: " + requestId);
    }
    if (!ApprovalStatus.APPROVED.equals(archiveExceptionRequest.approvalStatus())) {
      throw new IllegalStateException(
          "Only approved payment archive exception requests can register controlled actions: " + requestId);
    }
    int updated = paymentArchiveExceptionRequestMapper.updateActionStatus(
        tenantId,
        requestId,
        ARCHIVE_EXCEPTION_ACTION_COMPLETED,
        request.actionResult(),
        userId);
    if (updated == 0) {
      throw new IllegalStateException("Payment archive exception request action changed before it could be applied: " + requestId);
    }
    auditLogApplicationService.recordTenantAction(
        tenantId,
        "payment_archive_exception.action_completed",
        AuditTargetType.PAYMENT_BATCH,
        archiveExceptionRequest.paymentBatchNo());
    PaymentArchiveExceptionRequest savedRequest = paymentArchiveExceptionRequestMapper.findByTenantAndId(tenantId, requestId);
    return toPaymentArchiveExceptionRequestResponse(savedRequest);
  }

  @Transactional
  public PaymentArchiveExceptionRequestResponse closeCurrentTenantPaymentArchiveExceptionRequest(
      String requestId,
      ClosePaymentArchiveExceptionRequestRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("payment archive exception request APIs");
    String userId = TenantAccessGuard.requireUserId("payment archive exception request APIs");
    tenantFeatureApplicationService.requireEnabled(tenantId, TenantFeatureKey.FINANCE);
    PaymentArchiveExceptionRequest archiveExceptionRequest =
        paymentArchiveExceptionRequestMapper.findByTenantAndId(tenantId, requestId);
    if (archiveExceptionRequest == null) {
      throw new IllegalArgumentException("Payment archive exception request not found in tenant scope: " + requestId);
    }
    if (!ApprovalStatus.APPROVED.equals(archiveExceptionRequest.approvalStatus())
        || !ARCHIVE_EXCEPTION_ACTION_COMPLETED.equals(archiveExceptionRequest.actionStatus())) {
      throw new IllegalStateException(
          "Only controlled payment archive exception requests can be closed: " + requestId);
    }
    int updated = paymentArchiveExceptionRequestMapper.updateClosureStatus(
        tenantId,
        requestId,
        ARCHIVE_EXCEPTION_CLOSURE_CLOSED,
        request.closureResult(),
        userId);
    if (updated == 0) {
      throw new IllegalStateException("Payment archive exception request closure changed before it could be applied: " + requestId);
    }
    auditLogApplicationService.recordTenantAction(
        tenantId,
        "payment_archive_exception.closed",
        AuditTargetType.PAYMENT_BATCH,
        archiveExceptionRequest.paymentBatchNo());
    PaymentArchiveExceptionRequest savedRequest = paymentArchiveExceptionRequestMapper.findByTenantAndId(tenantId, requestId);
    return toPaymentArchiveExceptionRequestResponse(savedRequest);
  }

  @Transactional
  public PaymentBlockResolutionResponse createCurrentTenantPaymentBlockResolution(
      CreatePaymentBlockResolutionRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("payment block resolution APIs");
    String userId = TenantAccessGuard.requireUserId("payment block resolution APIs");
    tenantFeatureApplicationService.requireEnabled(tenantId, TenantFeatureKey.FINANCE);
    requirePaymentBatchNotArchived(tenantId, request.paymentBatchNo());
    paymentBlockResolutionMapper.upsert(
        "payblock-" + UUID.randomUUID(),
        tenantId,
        request.paymentBatchNo(),
        blankToNull(request.paymentRequestId()),
        blankToNull(request.invoiceId()),
        blankToNull(request.supplierId()),
        request.blockReason(),
        request.resolutionStatus(),
        request.resolutionAction(),
        request.nextStep(),
        blankToNull(request.handledBy()),
        userId);
    PaymentBlockResolution resolution = paymentBlockResolutionMapper.findByTenantAndNaturalKey(
        tenantId,
        request.paymentBatchNo(),
        blankToNull(request.paymentRequestId()),
        request.blockReason());
    auditLogApplicationService.recordTenantAction(
        tenantId,
        "payment_block_resolution.saved",
        AuditTargetType.PAYMENT_BATCH,
        request.paymentBatchNo());
    return toPaymentBlockResolutionResponse(resolution);
  }

  @Transactional
  public PaymentBlockResolutionResponse updateCurrentTenantPaymentBlockResolutionStatus(
      String resolutionId,
      UpdatePaymentBlockResolutionStatusRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("payment block resolution APIs");
    tenantFeatureApplicationService.requireEnabled(tenantId, TenantFeatureKey.FINANCE);
    PaymentBlockResolution resolution = paymentBlockResolutionMapper.findByTenantAndId(tenantId, resolutionId);
    if (resolution == null) {
      throw new IllegalArgumentException("Payment block resolution not found in tenant scope: " + resolutionId);
    }
    requirePaymentBatchNotArchived(tenantId, resolution.paymentBatchNo());
    paymentBlockResolutionMapper.updateStatus(
        tenantId,
        resolutionId,
        request.resolutionStatus(),
        request.resolutionAction() == null || request.resolutionAction().isBlank()
            ? resolution.resolutionAction()
            : request.resolutionAction(),
        request.nextStep() == null || request.nextStep().isBlank() ? resolution.nextStep() : request.nextStep(),
        blankToNull(request.handledBy()) == null ? resolution.handledBy() : request.handledBy());
    auditLogApplicationService.recordTenantAction(
        tenantId,
        "payment_block_resolution.updated",
        AuditTargetType.PAYMENT_BATCH,
        resolution.paymentBatchNo());
    return toPaymentBlockResolutionResponse(paymentBlockResolutionMapper.findByTenantAndId(tenantId, resolutionId));
  }

  @Transactional
  public List<PaymentExecutionRecordResponse> listCurrentTenantPaymentExecutionRecords(
      String paymentBatchNo,
      String executionStatus,
      String supplierId,
      String invoiceId) {
    String tenantId = TenantAccessGuard.requireTenantId("payment execution record APIs");
    paymentExecutionRecordMapper.refreshTenantFromPaymentRequests(tenantId);
    return paymentExecutionRecordMapper.listByTenantFiltered(
            tenantId,
            blankToNull(paymentBatchNo),
            blankToNull(executionStatus),
            blankToNull(supplierId),
            blankToNull(invoiceId))
        .stream()
        .map(this::toPaymentExecutionRecordResponse)
        .toList();
  }

  @Transactional
  public PaymentBatchResponse updateCurrentTenantPaymentBatchStatus(
      String paymentBatchNo,
      UpdatePaymentBatchStatusRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("payment batch APIs");
    tenantFeatureApplicationService.requireEnabled(tenantId, TenantFeatureKey.FINANCE);
    PaymentBatch paymentBatch = paymentBatchMapper.findByTenantAndPaymentBatchNo(tenantId, paymentBatchNo);
    if (paymentBatch == null) {
      throw new IllegalArgumentException("Payment batch not found in tenant scope: " + paymentBatchNo);
    }
    if ("已付款归档".equals(paymentBatch.batchStatus()) && !"已付款归档".equals(request.batchStatus())) {
      requirePaymentBatchNotArchived(tenantId, paymentBatchNo);
    }
    if ("可安排付款".equals(request.batchStatus())) {
      requirePaymentBatchRequestsApproved(paymentBatch);
    }
    if ("已付款归档".equals(request.batchStatus())) {
      paymentExecutionRecordMapper.refreshTenantFromPaymentRequests(tenantId);
      requirePaymentBatchArchiveReady(tenantId, paymentBatchNo);
    }
    paymentBatchMapper.updateStatus(tenantId, paymentBatchNo, request.batchStatus());
    paymentExecutionRecordMapper.refreshTenantFromPaymentRequests(tenantId);
    if ("审批中".equals(request.batchStatus())) {
      ensurePaymentBatchApprovalTask(tenantId, paymentBatch);
      auditLogApplicationService.recordTenantAction(
          tenantId,
          "payment_batch.submitted",
          AuditTargetType.PAYMENT_BATCH,
          paymentBatchNo);
    } else if ("可安排付款".equals(request.batchStatus())) {
      approvePendingPaymentBatchTask(tenantId, paymentBatch);
      auditLogApplicationService.recordTenantAction(
          tenantId,
          "payment_batch.approved",
          AuditTargetType.PAYMENT_BATCH,
          paymentBatchNo);
    } else if ("已付款归档".equals(request.batchStatus())) {
      auditLogApplicationService.recordTenantAction(
          tenantId,
          buildPaymentBatchArchiveAuditAction(tenantId, paymentBatchNo),
          AuditTargetType.PAYMENT_BATCH,
          paymentBatchNo);
    }
    return toPaymentBatchResponse(paymentBatchMapper.findByTenantAndPaymentBatchNo(tenantId, paymentBatchNo));
  }

  private void requirePaymentBatchRequestsApproved(PaymentBatch paymentBatch) {
    BigDecimal totalAmount = paymentBatch.totalAmount() == null ? BigDecimal.ZERO : paymentBatch.totalAmount();
    BigDecimal approvedAmount = paymentBatch.approvedAmount() == null ? BigDecimal.ZERO : paymentBatch.approvedAmount();
    if (paymentBatch.requestCount() == null
        || paymentBatch.requestCount() <= 0
        || approvedAmount.compareTo(totalAmount) < 0) {
      throw new IllegalStateException(
          "Payment batch cannot be approved until all payment requests are approved: "
              + paymentBatch.paymentBatchNo());
    }
  }

  private void requirePaymentBatchArchiveReady(String tenantId, String paymentBatchNo) {
    Map<String, Object> summary = paymentExecutionRecordMapper.summarizeByTenantAndBatch(tenantId, paymentBatchNo);
    int registeredCount = summaryInteger(summary, "registered_count");
    int pendingRegistrationCount = summaryInteger(summary, "pending_registration_count");
    int blockedRegistrationCount = summaryInteger(summary, "blocked_registration_count");
    String executionDecision = summary == null ? null : String.valueOf(summary.get("execution_decision"));
    if (registeredCount <= 0
        || pendingRegistrationCount > 0
        || blockedRegistrationCount > 0
        || !"批次付款已登记".equals(executionDecision)) {
      throw new IllegalStateException(
          "Payment batch cannot be archived until all execution records are registered: " + paymentBatchNo);
    }
  }

  private void requirePaymentBatchNotArchived(String tenantId, String paymentBatchNo) {
    PaymentBatch paymentBatch = paymentBatchMapper.findByTenantAndPaymentBatchNo(tenantId, paymentBatchNo);
    if (paymentBatch != null && "已付款归档".equals(paymentBatch.batchStatus())) {
      throw new IllegalStateException("Payment batch is archived and can only be audited: " + paymentBatchNo);
    }
  }

  private void requirePaymentBatchArchived(String tenantId, String paymentBatchNo) {
    PaymentBatch paymentBatch = paymentBatchMapper.findByTenantAndPaymentBatchNo(tenantId, paymentBatchNo);
    if (paymentBatch == null) {
      throw new IllegalArgumentException("Payment batch not found in tenant scope: " + paymentBatchNo);
    }
    if (!"已付款归档".equals(paymentBatch.batchStatus())) {
      throw new IllegalStateException(
          "Payment archive exception request requires archived batch: " + paymentBatchNo);
    }
  }

  private String buildPaymentBatchArchiveAuditAction(String tenantId, String paymentBatchNo) {
    Map<String, Object> summary = paymentExecutionRecordMapper.summarizeByTenantAndBatch(tenantId, paymentBatchNo);
    return "payment_batch.archived|registered=" + summaryInteger(summary, "registered_count")
        + "|amount=" + summaryBigDecimal(summary, "registered_amount").stripTrailingZeros().toPlainString()
        + "|decision=" + (summary == null ? "unknown" : String.valueOf(summary.get("execution_decision")));
  }

  private int summaryInteger(Map<String, Object> summary, String key) {
    Object value = summary == null ? null : summary.get(key);
    if (value instanceof Number number) {
      return number.intValue();
    }
    return 0;
  }

  private BigDecimal summaryBigDecimal(Map<String, Object> summary, String key) {
    Object value = summary == null ? null : summary.get(key);
    if (value instanceof BigDecimal decimal) {
      return decimal;
    }
    if (value instanceof Number number) {
      return BigDecimal.valueOf(number.doubleValue());
    }
    return BigDecimal.ZERO;
  }

  @Transactional
  public PaymentExecutionRecordResponse registerCurrentTenantPaymentExecutionRecord(String executionRecordId) {
    String tenantId = TenantAccessGuard.requireTenantId("payment execution record APIs");
    tenantFeatureApplicationService.requireEnabled(tenantId, TenantFeatureKey.FINANCE);
    PaymentExecutionRecord record = paymentExecutionRecordMapper.findByTenantAndId(tenantId, executionRecordId);
    if (record == null) {
      throw new IllegalArgumentException("Payment execution record not found in tenant scope: " + executionRecordId);
    }
    requirePaymentBatchNotArchived(tenantId, record.paymentBatchNo());
    if (!record.executionStatus().equals("待登记付款")) {
      throw new IllegalStateException("Payment execution record is not ready for registration: " + executionRecordId);
    }
    paymentApplicationService.register(record.invoiceId(), new RegisterPaymentRequest("已付款"));
    paymentExecutionRecordMapper.refreshByTenantAndId(tenantId, executionRecordId);
    PaymentExecutionRecord refreshed = paymentExecutionRecordMapper.findByTenantAndId(tenantId, executionRecordId);
    return toPaymentExecutionRecordResponse(refreshed);
  }

  public List<ThreeWayMatchResponse> listCurrentTenantThreeWayMatches(
      String matchStatus,
      String supplierId,
      String orderId,
      String invoiceId) {
    String tenantId = TenantAccessGuard.requireTenantId("three-way match APIs");
    return threeWayMatchMapper.listByTenantFiltered(
            tenantId,
            blankToNull(matchStatus),
            blankToNull(supplierId),
            blankToNull(orderId),
            blankToNull(invoiceId))
        .stream()
        .map(this::toThreeWayMatchResponse)
        .toList();
  }

  // 行级三单匹配:给定发票,按订单行项逐行对照订单/收货/发票,标注金额差异与数量短缺。
  public List<ThreeWayMatchLineResponse> listCurrentTenantThreeWayMatchLines(String invoiceId) {
    String tenantId = TenantAccessGuard.requireTenantId("three-way match APIs");
    Invoice invoice = invoiceMapper.findByTenantAndId(tenantId, invoiceId);
    if (invoice == null) {
      throw new IllegalArgumentException("Invoice not found in tenant scope: " + invoiceId);
    }
    return threeWayMatchMapper.listLineReconciliation(tenantId, invoice.orderId(), invoiceId).stream()
        .map(this::toThreeWayMatchLineResponse)
        .toList();
  }

  private ThreeWayMatchLineResponse toThreeWayMatchLineResponse(ThreeWayMatchLineRow row) {
    BigDecimal invoiceLineAmount = row.invoiceLineAmount();
    BigDecimal amountVariance =
        invoiceLineAmount == null
            ? BigDecimal.ZERO
            : invoiceLineAmount.subtract(row.orderLineAmount());
    String status;
    if (invoiceLineAmount == null) {
      status = "未开票";
    } else if (amountVariance.compareTo(BigDecimal.ZERO) != 0) {
      status = "金额差异";
    } else if (row.receivedQuantity() == null) {
      status = "待收货";
    } else if (row.qualifiedQuantity() != null
        && row.orderedQuantity() != null
        && row.qualifiedQuantity().compareTo(row.orderedQuantity()) < 0) {
      status = "数量短缺";
    } else {
      status = "三单一致";
    }
    return new ThreeWayMatchLineResponse(
        row.orderLineId(),
        row.description(),
        row.unit(),
        row.orderedQuantity(),
        row.orderUnitPrice(),
        row.orderLineAmount(),
        row.receivedQuantity(),
        row.qualifiedQuantity(),
        row.invoicedQuantity(),
        row.invoiceUnitPrice(),
        invoiceLineAmount,
        amountVariance,
        status);
  }

  @Transactional
  public ThreeWayMatchRebuildResponse rebuildCurrentTenantThreeWayMatches() {
    String tenantId = TenantAccessGuard.requireTenantId("three-way match APIs");
    tenantFeatureApplicationService.requireEnabled(tenantId, TenantFeatureKey.FINANCE);
    int rebuiltCount = threeWayMatchMapper.rebuildByTenant(tenantId).size();
    return new ThreeWayMatchRebuildResponse(tenantId, rebuiltCount);
  }

  @Transactional
  public VarianceHandlingResponse createVarianceHandlingFromThreeWayMatch(String matchId) {
    String tenantId = TenantAccessGuard.requireTenantId("three-way match APIs");
    String userId = TenantAccessGuard.requireUserId("three-way match APIs");
    tenantFeatureApplicationService.requireEnabled(tenantId, TenantFeatureKey.FINANCE);
    ThreeWayMatch match = threeWayMatchMapper.findByTenantAndId(tenantId, matchId);
    if (match == null) {
      throw new IllegalArgumentException("Three-way match not found in tenant scope: " + matchId);
    }
    if (!"金额差异".equals(match.matchStatus())) {
      throw new IllegalStateException("Only amount variance three-way matches can create variance handling: " + matchId);
    }
    varianceHandlingMapper.upsert(
        "variance-" + UUID.randomUUID(),
        tenantId,
        match.invoiceId(),
        match.supplierId(),
        match.orderId(),
        match.varianceAmount(),
        match.blockingReason(),
        userId,
        "待财务复核",
        "待处理",
        userId,
        null,
        null);
    auditLogApplicationService.recordTenantAction(
        tenantId,
        "variance_handling.created_from_three_way_match",
        AuditTargetType.INVOICE,
        match.invoiceId());
    return toVarianceHandlingResponse(varianceHandlingMapper.findByTenantAndInvoice(tenantId, match.invoiceId()));
  }

  // 行级差异处理:从某条被标记的发票行项(金额差异/数量短缺)发起差异处理,
  // 标注触发行(orderLineId + 品名)并以该行的差异金额/结论为依据。
  @Transactional
  public VarianceHandlingResponse createVarianceHandlingFromMatchLine(
      String invoiceId, String orderLineId) {
    String tenantId = TenantAccessGuard.requireTenantId("three-way match APIs");
    String userId = TenantAccessGuard.requireUserId("three-way match APIs");
    tenantFeatureApplicationService.requireEnabled(tenantId, TenantFeatureKey.FINANCE);
    Invoice invoice = requireTenantInvoice(tenantId, invoiceId);
    ThreeWayMatchLineResponse line =
        listCurrentTenantThreeWayMatchLines(invoiceId).stream()
            .filter(l -> orderLineId.equals(l.orderLineId()))
            .findFirst()
            .orElseThrow(
                () ->
                    new IllegalArgumentException(
                        "Order line not found for invoice " + invoiceId + ": " + orderLineId));
    if (!"金额差异".equals(line.lineMatchStatus()) && !"数量短缺".equals(line.lineMatchStatus())) {
      throw new IllegalStateException(
          "Only flagged invoice lines can open variance handling: " + orderLineId);
    }
    String reason = line.description() + " · " + line.lineMatchStatus();
    varianceHandlingMapper.upsert(
        "variance-" + UUID.randomUUID(),
        tenantId,
        invoice.id(),
        invoice.supplierId(),
        invoice.orderId(),
        line.amountVariance(),
        reason,
        userId,
        "待财务复核",
        "待处理",
        userId,
        orderLineId,
        line.description());
    auditLogApplicationService.recordTenantAction(
        tenantId, "variance_handling.created_from_match_line", AuditTargetType.INVOICE, invoice.id());
    return toVarianceHandlingResponse(varianceHandlingMapper.findByTenantAndInvoice(tenantId, invoice.id()));
  }

  public List<PaymentRequestResponse> listCurrentTenantPaymentRequests(
      String requestStatus,
      String supplierId,
      String orderId,
      String invoiceId) {
    String tenantId = TenantAccessGuard.requireTenantId("payment request APIs");
    return paymentRequestMapper.listByTenantFiltered(
            tenantId,
            blankToNull(requestStatus),
            blankToNull(supplierId),
            blankToNull(orderId),
            blankToNull(invoiceId))
        .stream()
        .map(this::toPaymentRequestResponse)
        .toList();
  }

  public List<VarianceHandlingResponse> listCurrentTenantVarianceHandlings(
      String status,
      String supplierId,
      String orderId,
      String invoiceId) {
    String tenantId = TenantAccessGuard.requireTenantId("variance handling APIs");
    return varianceHandlingMapper.listByTenantFiltered(
            tenantId,
            blankToNull(status),
            blankToNull(supplierId),
            blankToNull(orderId),
            blankToNull(invoiceId))
        .stream()
        .map(this::toVarianceHandlingResponse)
        .toList();
  }

  @Transactional
  public PaymentRequestResponse createCurrentTenantPaymentRequest(CreatePaymentRequestRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("payment request APIs");
    String userId = TenantAccessGuard.requireUserId("payment request APIs");
    permissionService.require("buyer:payment:register"); // 发起付款申请须具备该权限
    tenantFeatureApplicationService.requireEnabled(tenantId, TenantFeatureKey.FINANCE);
    Invoice invoice = requireTenantInvoice(tenantId, request.invoiceId());
    ensureAmountVarianceHandledBeforePaymentRequest(tenantId, invoice);
    PaymentRequest existingRequest = paymentRequestMapper.findByTenantAndInvoice(tenantId, invoice.id());
    if (existingRequest != null) {
      requirePaymentRequestNotExecuted(tenantId, existingRequest);
      requirePaymentBatchNotArchived(tenantId, existingRequest.paymentBatchNo());
    }
    paymentRequestMapper.upsert(
        "payreq-" + UUID.randomUUID(),
        tenantId,
        invoice.id(),
        invoice.supplierId(),
        invoice.orderId(),
        invoice.amount(),
        request.requestStatus(),
        request.paymentBatchNo(),
        request.remark(),
        userId);
    syncPaymentBatch(tenantId, request.paymentBatchNo());
    PaymentRequest savedRequest = paymentRequestMapper.findByTenantAndInvoice(tenantId, invoice.id());
    syncPaymentExecutionRecord(tenantId, savedRequest.id());
    if (existingRequest != null && !existingRequest.paymentBatchNo().equals(request.paymentBatchNo())) {
      syncPaymentBatch(tenantId, existingRequest.paymentBatchNo());
    }
    return toPaymentRequestResponse(savedRequest);
  }

  private void ensureAmountVarianceHandledBeforePaymentRequest(String tenantId, Invoice invoice) {
    ThreeWayMatch match = threeWayMatchMapper.listByTenantFiltered(
            tenantId,
            null,
            null,
            null,
            invoice.id())
        .stream()
        .findFirst()
        .orElse(null);
    if (match == null || !"金额差异".equals(match.matchStatus())) {
      return;
    }
    VarianceHandling handling = varianceHandlingMapper.findByTenantAndInvoice(tenantId, invoice.id());
    if (handling != null && "已处理".equals(handling.status())) {
      return;
    }
    throw new IllegalStateException("Amount variance must be handled before payment request: " + invoice.id());
  }

  @Transactional
  public PaymentRequestResponse updateCurrentTenantPaymentRequestStatus(
      String paymentRequestId,
      UpdatePaymentRequestStatusRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("payment request APIs");
    tenantFeatureApplicationService.requireEnabled(tenantId, TenantFeatureKey.FINANCE);
    PaymentRequest paymentRequest = paymentRequestMapper.findByTenantAndId(tenantId, paymentRequestId);
    if (paymentRequest == null) {
      throw new IllegalArgumentException("Payment request not found in tenant scope: " + paymentRequestId);
    }
    requirePaymentBatchNotArchived(tenantId, paymentRequest.paymentBatchNo());
    requirePaymentRequestNotExecuted(tenantId, paymentRequest);
    paymentRequestMapper.updateStatus(tenantId, paymentRequestId, request.requestStatus());
    syncPaymentBatch(tenantId, paymentRequest.paymentBatchNo());
    syncPaymentExecutionRecord(tenantId, paymentRequestId);
    if ("付款申请审批中".equals(request.requestStatus())) {
      ensurePaymentRequestApprovalTask(tenantId, paymentRequest);
      auditLogApplicationService.recordTenantAction(
          tenantId,
          "payment_request.submitted",
          AuditTargetType.INVOICE,
          paymentRequest.invoiceId());
    } else if ("付款申请已通过".equals(request.requestStatus())) {
      approvePendingPaymentRequestTask(tenantId, paymentRequest);
      auditLogApplicationService.recordTenantAction(
          tenantId,
          "payment_request.approved",
          AuditTargetType.INVOICE,
          paymentRequest.invoiceId());
    }
    return toPaymentRequestResponse(paymentRequestMapper.findByTenantAndId(tenantId, paymentRequestId));
  }

  @Transactional
  public VarianceHandlingResponse createCurrentTenantVarianceHandling(CreateVarianceHandlingRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("variance handling APIs");
    String userId = TenantAccessGuard.requireUserId("variance handling APIs");
    tenantFeatureApplicationService.requireEnabled(tenantId, TenantFeatureKey.FINANCE);
    Invoice invoice = requireTenantInvoice(tenantId, request.invoiceId());
    PurchaseOrder order = purchaseOrderMapper.findByTenantAndId(tenantId, invoice.orderId());
    BigDecimal varianceAmount = order == null ? BigDecimal.ZERO : invoice.amount().subtract(order.amount());
    varianceHandlingMapper.upsert(
        "variance-" + UUID.randomUUID(),
        tenantId,
        invoice.id(),
        invoice.supplierId(),
        invoice.orderId(),
        varianceAmount,
        request.reason(),
        request.ownerId(),
        request.result(),
        request.status(),
        userId,
        null,
        null);
    return toVarianceHandlingResponse(varianceHandlingMapper.findByTenantAndInvoice(tenantId, invoice.id()));
  }

  @Transactional
  public VarianceHandlingResponse updateCurrentTenantVarianceHandlingStatus(
      String varianceHandlingId,
      UpdateVarianceHandlingStatusRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("variance handling APIs");
    tenantFeatureApplicationService.requireEnabled(tenantId, TenantFeatureKey.FINANCE);
    VarianceHandling varianceHandling = varianceHandlingMapper.findByTenantAndId(tenantId, varianceHandlingId);
    if (varianceHandling == null) {
      throw new IllegalArgumentException("Variance handling not found in tenant scope: " + varianceHandlingId);
    }
    PaymentRequest linkedPaymentRequest =
        paymentRequestMapper.findByTenantAndInvoice(tenantId, varianceHandling.invoiceId());
    if (linkedPaymentRequest != null) {
      requirePaymentBatchNotArchived(tenantId, linkedPaymentRequest.paymentBatchNo());
    }
    String result = request.result() == null || request.result().isBlank()
        ? varianceHandling.result()
        : request.result();
    String status = request.status();
    // 差异分级审批:超阈值差异不能由买方直接结案,改置「待财务经理签核」(付款仍阻断)。
    if (VarianceApprovalPolicy.STATUS_RESOLVED.equals(status)
        && VarianceApprovalPolicy.requiresManagerApproval(varianceHandling.varianceAmount())) {
      status = VarianceApprovalPolicy.STATUS_MANAGER_REVIEW;
      result =
          "差异金额 " + varianceHandling.varianceAmount() + " 达 ¥10,000 阈值,转财务经理签核";
    }
    varianceHandlingMapper.updateStatus(tenantId, varianceHandlingId, status, result);
    auditLogApplicationService.recordTenantAction(
        tenantId,
        "variance_handling.updated",
        AuditTargetType.INVOICE,
        varianceHandling.invoiceId());
    return toVarianceHandlingResponse(varianceHandlingMapper.findByTenantAndId(tenantId, varianceHandlingId));
  }

  // 财务经理签核超阈值差异:通过→已处理(解除付款阻断),驳回→退回待处理。
  @Transactional
  public VarianceHandlingResponse approveCurrentTenantVarianceHandling(
      String varianceHandlingId, ApproveVarianceHandlingRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("variance handling APIs");
    permissionService.require("buyer:variance:approve"); // 财务经理签核须具备该权限
    tenantFeatureApplicationService.requireEnabled(tenantId, TenantFeatureKey.FINANCE);
    VarianceHandling varianceHandling =
        varianceHandlingMapper.findByTenantAndId(tenantId, varianceHandlingId);
    if (varianceHandling == null) {
      throw new IllegalArgumentException(
          "Variance handling not found in tenant scope: " + varianceHandlingId);
    }
    if (!VarianceApprovalPolicy.STATUS_MANAGER_REVIEW.equals(varianceHandling.status())) {
      throw new IllegalStateException(
          "Only variance handlings pending manager approval can be reviewed: " + varianceHandlingId);
    }
    boolean approved = Boolean.TRUE.equals(request.approved());
    String status =
        approved ? VarianceApprovalPolicy.STATUS_RESOLVED : VarianceApprovalPolicy.STATUS_PENDING;
    String result =
        request.comment() == null || request.comment().isBlank()
            ? (approved ? "财务经理签核通过,差异结案" : "财务经理驳回,退回重新核实")
            : request.comment();
    varianceHandlingMapper.updateStatus(tenantId, varianceHandlingId, status, result);
    auditLogApplicationService.recordTenantAction(
        tenantId,
        approved ? "variance_handling.manager_approved" : "variance_handling.manager_rejected",
        AuditTargetType.INVOICE,
        varianceHandling.invoiceId());
    return toVarianceHandlingResponse(
        varianceHandlingMapper.findByTenantAndId(tenantId, varianceHandlingId));
  }

  // ============ 报表导出(发票清单 / 对账单 / 采购分析)============

  private static String money(BigDecimal v) {
    return v == null ? "" : v.toPlainString();
  }

  private static String orEmpty(String v) {
    return v == null ? "" : v;
  }

  public FinanceReport exportInvoices(String format) {
    String tenantId = TenantAccessGuard.requireTenantId("report APIs");
    permissionService.require("buyer:report:export");
    List<String> headers =
        List.of("发票号", "发票代码", "订单", "供应商", "价税合计", "税率(%)", "开票日期", "付款状态");
    List<List<String>> rows = new ArrayList<>();
    for (Invoice inv : invoiceMapper.listByTenant(tenantId)) {
      rows.add(List.of(
          orEmpty(inv.invoiceNo()),
          orEmpty(inv.invoiceCode()),
          orEmpty(inv.orderId()),
          orEmpty(inv.supplierId()),
          money(inv.amount()),
          money(inv.taxRate()),
          inv.invoiceDate() == null ? "" : inv.invoiceDate().toString(),
          orEmpty(inv.paymentStatus())));
    }
    return render("发票清单", "invoices", headers, rows, format);
  }

  public FinanceReport exportReconciliation(String format) {
    String tenantId = TenantAccessGuard.requireTenantId("report APIs");
    permissionService.require("buyer:report:export");
    List<String> headers =
        List.of("发票", "订单", "供应商", "订单金额", "发票金额", "差异金额", "匹配状态", "收货状态", "付款就绪");
    List<List<String>> rows = new ArrayList<>();
    for (ThreeWayMatch m : threeWayMatchMapper.listByTenantFiltered(tenantId, null, null, null, null)) {
      rows.add(List.of(
          orEmpty(m.invoiceId()),
          orEmpty(m.orderId()),
          orEmpty(m.supplierId()),
          money(m.orderAmount()),
          money(m.invoiceAmount()),
          money(m.varianceAmount()),
          orEmpty(m.matchStatus()),
          orEmpty(m.receiptStatus()),
          orEmpty(m.paymentReadiness())));
    }
    return render("三单匹配对账单", "reconciliation", headers, rows, format);
  }

  // 采购分析:按订单状态汇总订单数与金额(含合计行)。
  public FinanceReport exportProcurementAnalytics(String format) {
    String tenantId = TenantAccessGuard.requireTenantId("report APIs");
    permissionService.require("buyer:report:export");
    Map<String, long[]> byStatusCount = new LinkedHashMap<>();
    Map<String, BigDecimal> byStatusAmount = new LinkedHashMap<>();
    BigDecimal total = BigDecimal.ZERO;
    long totalCount = 0;
    for (PurchaseOrder po : purchaseOrderMapper.listByTenant(tenantId)) {
      String status = orEmpty(po.status());
      byStatusCount.computeIfAbsent(status, k -> new long[1])[0]++;
      byStatusAmount.merge(status, po.amount() == null ? BigDecimal.ZERO : po.amount(), BigDecimal::add);
      total = total.add(po.amount() == null ? BigDecimal.ZERO : po.amount());
      totalCount++;
    }
    List<String> headers = List.of("订单状态", "订单数", "订单金额合计");
    List<List<String>> rows = new ArrayList<>();
    for (String status : byStatusCount.keySet()) {
      rows.add(List.of(status, String.valueOf(byStatusCount.get(status)[0]), money(byStatusAmount.get(status))));
    }
    rows.add(List.of("合计", String.valueOf(totalCount), money(total)));
    return render("采购分析汇总", "procurement-analytics", headers, rows, format);
  }

  private FinanceReport render(
      String title, String base, List<String> headers, List<List<String>> rows, String format) {
    if ("pdf".equalsIgnoreCase(format)) {
      return new FinanceReport(
          FinanceReportRenderer.toPdf(title, headers, rows),
          base + ".pdf",
          FinanceReport.PDF_CONTENT_TYPE);
    }
    return new FinanceReport(
        FinanceReportRenderer.toXlsx(title, headers, rows),
        base + ".xlsx",
        FinanceReport.XLSX_CONTENT_TYPE);
  }

  private void syncPaymentBatch(String tenantId, String paymentBatchNo) {
    paymentBatchMapper.upsertFromPaymentRequests(
        "paybatch-" + UUID.randomUUID(),
        tenantId,
        paymentBatchNo);
    paymentBatchMapper.deleteIfEmpty(tenantId, paymentBatchNo);
  }

  private void syncPaymentExecutionRecord(String tenantId, String paymentRequestId) {
    paymentExecutionRecordMapper.upsertFromPaymentRequest(
        "payexec-" + UUID.randomUUID(),
        tenantId,
        paymentRequestId);
  }

  private void requirePaymentRequestNotExecuted(String tenantId, PaymentRequest paymentRequest) {
    boolean registered = paymentExecutionRecordMapper.listByTenantFiltered(
            tenantId,
            paymentRequest.paymentBatchNo(),
            "已登记付款",
            paymentRequest.supplierId(),
            paymentRequest.invoiceId())
        .stream()
        .anyMatch(record -> paymentRequest.id().equals(record.paymentRequestId()));
    if (registered) {
      throw new IllegalStateException("Payment request already has registered execution: " + paymentRequest.id());
    }
  }

  private void ensurePaymentRequestApprovalTask(String tenantId, PaymentRequest paymentRequest) {
    ApprovalTask existingTask = approvalTaskMapper.findPendingByBiz(
        tenantId,
        ApprovalBusinessType.PAYMENT_REQUEST,
        paymentRequest.id(),
        ApprovalStatus.PENDING);
    if (existingTask == null) {
      approvalTaskApplicationService.createPendingTask(
          tenantId,
          ApprovalBusinessType.PAYMENT_REQUEST,
          paymentRequest.id(),
          null);
    }
  }

  private void approvePendingPaymentRequestTask(String tenantId, PaymentRequest paymentRequest) {
    ApprovalTask existingTask = approvalTaskMapper.findPendingByBiz(
        tenantId,
        ApprovalBusinessType.PAYMENT_REQUEST,
        paymentRequest.id(),
        ApprovalStatus.PENDING);
    if (existingTask != null) {
      approvalTaskMapper.updateStatus(
          tenantId,
          existingTask.id(),
          ApprovalStatus.PENDING,
          ApprovalStatus.APPROVED,
          existingTask.assigneeId(),
          null);
    }
  }

  private void ensurePaymentBatchApprovalTask(String tenantId, PaymentBatch paymentBatch) {
    ApprovalTask existingTask = approvalTaskMapper.findPendingByBiz(
        tenantId,
        ApprovalBusinessType.PAYMENT_BATCH,
        paymentBatch.paymentBatchNo(),
        ApprovalStatus.PENDING);
    if (existingTask == null) {
      approvalTaskApplicationService.createPendingTask(
          tenantId,
          ApprovalBusinessType.PAYMENT_BATCH,
          paymentBatch.paymentBatchNo(),
          null);
    }
  }

  private void ensurePaymentArchiveExceptionApprovalTask(
      String tenantId,
      PaymentArchiveExceptionRequest request) {
    ApprovalTask existingTask = approvalTaskMapper.findPendingByBiz(
        tenantId,
        ApprovalBusinessType.PAYMENT_ARCHIVE_EXCEPTION,
        request.id(),
        ApprovalStatus.PENDING);
    if (existingTask == null) {
      approvalTaskApplicationService.createPendingTask(
          tenantId,
          ApprovalBusinessType.PAYMENT_ARCHIVE_EXCEPTION,
          request.id(),
          null);
    }
  }

  private void approvePendingPaymentBatchTask(String tenantId, PaymentBatch paymentBatch) {
    ApprovalTask existingTask = approvalTaskMapper.findPendingByBiz(
        tenantId,
        ApprovalBusinessType.PAYMENT_BATCH,
        paymentBatch.paymentBatchNo(),
        ApprovalStatus.PENDING);
    if (existingTask != null) {
      approvalTaskMapper.updateStatus(
          tenantId,
          existingTask.id(),
          ApprovalStatus.PENDING,
          ApprovalStatus.APPROVED,
          existingTask.assigneeId(),
          null);
    }
  }

  private Invoice requireTenantInvoice(String tenantId, String invoiceId) {
    Invoice invoice = invoiceMapper.findByTenantAndId(tenantId, invoiceId);
    if (invoice == null) {
      throw new IllegalArgumentException("Invoice not found in tenant scope: " + invoiceId);
    }
    return invoice;
  }

  private PaymentRequestResponse toPaymentRequestResponse(PaymentRequest request) {
    return new PaymentRequestResponse(
        request.id(),
        request.tenantId(),
        request.invoiceId(),
        request.supplierId(),
        request.orderId(),
        request.amount(),
        request.requestStatus(),
        request.paymentBatchNo(),
        request.remark(),
        request.createdBy(),
        request.createdAt(),
        request.updatedAt());
  }

  private PaymentBatchResponse toPaymentBatchResponse(PaymentBatch batch) {
    return new PaymentBatchResponse(
        batch.id(),
        batch.tenantId(),
        batch.paymentBatchNo(),
        batch.supplierId(),
        batch.requestCount(),
        batch.totalAmount(),
        batch.approvedAmount(),
        batch.registeredAmount(),
        batch.pendingRegistrationAmount(),
        batch.blockedRegistrationAmount(),
        batch.registeredCount(),
        batch.pendingRegistrationCount(),
        batch.blockedRegistrationCount(),
        batch.executionDecision(),
        batch.executionBlockSummary(),
        batch.batchStatus(),
        batch.plannedPaymentDate(),
        batch.createdAt(),
        batch.updatedAt());
  }

  private PaymentBlockResolutionResponse toPaymentBlockResolutionResponse(PaymentBlockResolution resolution) {
    return new PaymentBlockResolutionResponse(
        resolution.id(),
        resolution.tenantId(),
        resolution.paymentBatchNo(),
        resolution.paymentRequestId(),
        resolution.invoiceId(),
        resolution.supplierId(),
        resolution.blockReason(),
        resolution.resolutionStatus(),
        resolution.resolutionAction(),
        resolution.nextStep(),
        resolution.handledBy(),
        resolution.createdBy(),
        resolution.createdAt(),
        resolution.updatedAt());
  }

  private PaymentArchiveExceptionRequestResponse toPaymentArchiveExceptionRequestResponse(
      PaymentArchiveExceptionRequest request) {
    return new PaymentArchiveExceptionRequestResponse(
        request.id(),
        request.tenantId(),
        request.paymentBatchNo(),
        request.exceptionType(),
        request.exceptionReason(),
        request.approvalStatus(),
        request.actionStatus() == null ? ARCHIVE_EXCEPTION_ACTION_PENDING : request.actionStatus(),
        request.actionResult(),
        request.closureStatus() == null ? ARCHIVE_EXCEPTION_CLOSURE_PENDING : request.closureStatus(),
        request.closureResult(),
        request.requestedBy(),
        request.reviewedBy(),
        request.handledBy(),
        request.closedBy(),
        request.createdAt(),
        request.updatedAt());
  }

  private PaymentExecutionRecordResponse toPaymentExecutionRecordResponse(PaymentExecutionRecord record) {
    return new PaymentExecutionRecordResponse(
        record.id(),
        record.tenantId(),
        record.paymentBatchNo(),
        record.paymentRequestId(),
        record.invoiceId(),
        record.supplierId(),
        record.registeredAmount(),
        record.plannedPaymentDate(),
        record.executionStatus(),
        record.executionTrace(),
        record.executionBlockReason(),
        derivePaymentExecutionStage(record),
        derivePaymentExecutionNextAction(record),
        record.createdBy(),
        record.createdAt(),
        record.updatedAt());
  }

  private String derivePaymentExecutionStage(PaymentExecutionRecord record) {
    if ("已登记付款".equals(record.executionStatus())) {
      return "已登记待归档";
    }
    if ("待登记付款".equals(record.executionStatus())) {
      return "可登记付款";
    }
    if ("付款审批中".equals(record.executionStatus())) {
      return "审批中待复核";
    }
    return "阻断待处理";
  }

  private String derivePaymentExecutionNextAction(PaymentExecutionRecord record) {
    if ("已登记付款".equals(record.executionStatus())) {
      return "刷新执行记录后归档审计";
    }
    if ("待登记付款".equals(record.executionStatus())) {
      return "登记付款状态，真实支付仍不接入";
    }
    if ("付款审批中".equals(record.executionStatus())) {
      return "完成付款申请审批后刷新执行复核";
    }
    String blockReason = record.executionBlockReason();
    if (blockReason == null || blockReason.isBlank()) {
      return "按阻断原因处理后刷新执行复核";
    }
    return "处理" + blockReason + "后刷新执行复核";
  }

  private ThreeWayMatchResponse toThreeWayMatchResponse(ThreeWayMatch match) {
    return new ThreeWayMatchResponse(
        match.id(),
        match.tenantId(),
        match.invoiceId(),
        match.supplierId(),
        match.orderId(),
        match.orderAmount(),
        match.receiptStatus(),
        match.invoiceAmount(),
        match.varianceAmount(),
        match.matchStatus(),
        match.blockingReason(),
        match.paymentReadiness(),
        match.createdAt(),
        match.updatedAt());
  }

  private VarianceHandlingResponse toVarianceHandlingResponse(VarianceHandling handling) {
    return new VarianceHandlingResponse(
        handling.id(),
        handling.tenantId(),
        handling.invoiceId(),
        handling.supplierId(),
        handling.orderId(),
        handling.varianceAmount(),
        handling.reason(),
        handling.ownerId(),
        handling.result(),
        handling.status(),
        handling.createdBy(),
        handling.createdAt(),
        handling.updatedAt(),
        handling.orderLineId(),
        handling.lineDescription());
  }

  private String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value;
  }
}
