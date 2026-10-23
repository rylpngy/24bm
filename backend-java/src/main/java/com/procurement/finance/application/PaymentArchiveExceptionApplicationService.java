package com.procurement.finance.application;

import com.procurement.identity.application.PermissionService;
import com.procurement.identity.domain.DataScope;
import com.procurement.approval.domain.ApprovalBusinessType;
import com.procurement.approval.domain.ApprovalStatus;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.domain.AuditTargetType;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.finance.api.ClosePaymentArchiveExceptionRequestRequest;
import com.procurement.finance.api.CompletePaymentArchiveExceptionActionRequest;
import com.procurement.finance.api.CreatePaymentArchiveExceptionRequestRequest;
import com.procurement.finance.api.PaymentArchiveExceptionRequestResponse;
import com.procurement.finance.api.ReviewPaymentArchiveExceptionRequest;
import com.procurement.common.api.ApprovalTaskResponse;
import com.procurement.finance.domain.PaymentArchiveExceptionRequest;
import com.procurement.finance.domain.PaymentBatch;
import com.procurement.finance.infrastructure.PaymentArchiveExceptionRequestMapper;
import com.procurement.finance.infrastructure.PaymentBatchMapper;
import com.procurement.tenant.application.TenantFeatureApplicationService;
import com.procurement.tenant.domain.TenantFeatureKey;
import com.procurement.workflow.application.UnifiedWorkflowApplicationService;
import com.procurement.workflow.application.WorkflowStartCommand;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PaymentArchiveExceptionApplicationService {
  private static final String ARCHIVE_EXCEPTION_ACTION_PENDING = "待处理";
  private static final String ARCHIVE_EXCEPTION_ACTION_COMPLETED = "已登记受控处理";
  private static final String ARCHIVE_EXCEPTION_CLOSURE_PENDING = "待关闭";
  private static final String ARCHIVE_EXCEPTION_CLOSURE_CLOSED = "已关闭";

  private final PaymentArchiveExceptionRequestMapper paymentArchiveExceptionRequestMapper;
  private final PaymentBatchMapper paymentBatchMapper;
  private final AuditLogApplicationService auditLogApplicationService;
  private final TenantFeatureApplicationService tenantFeatureApplicationService;
  private final PermissionService permissionService;
  private final FinanceAccessService financeAccess;
  private final UnifiedWorkflowApplicationService unifiedWorkflowApplicationService;

  public PaymentArchiveExceptionApplicationService(
      PaymentArchiveExceptionRequestMapper paymentArchiveExceptionRequestMapper,
      PaymentBatchMapper paymentBatchMapper,
      AuditLogApplicationService auditLogApplicationService,
      TenantFeatureApplicationService tenantFeatureApplicationService,
      PermissionService permissionService,
      FinanceAccessService financeAccess,
      UnifiedWorkflowApplicationService unifiedWorkflowApplicationService) {
    this.paymentArchiveExceptionRequestMapper = paymentArchiveExceptionRequestMapper;
    this.paymentBatchMapper = paymentBatchMapper;
    this.auditLogApplicationService = auditLogApplicationService;
    this.tenantFeatureApplicationService = tenantFeatureApplicationService;
    this.permissionService = permissionService;
    this.financeAccess = financeAccess;
    this.unifiedWorkflowApplicationService = java.util.Objects.requireNonNull(unifiedWorkflowApplicationService);
  }

  public List<PaymentArchiveExceptionRequestResponse> listCurrentTenantPaymentArchiveExceptionRequests(
      String paymentBatchNo,
      String approvalStatus,
      String exceptionType) {
    String tenantId = TenantAccessGuard.requireTenantId("payment archive exception request APIs");
    DataScope scope = financeAccess.readScope();
    if (scope.blocksAll()) return List.of();
    return paymentArchiveExceptionRequestMapper.listVisible(
            tenantId,
            blankToNull(paymentBatchNo),
            blankToNull(approvalStatus),
            blankToNull(exceptionType), scope)
        .stream()
        .map(this::toPaymentArchiveExceptionRequestResponse)
        .toList();
  }

  @Transactional
  public PaymentArchiveExceptionRequestResponse createCurrentTenantPaymentArchiveExceptionRequest(
      CreatePaymentArchiveExceptionRequestRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("payment archive exception request APIs");
    String userId = TenantAccessGuard.requireUserId("payment archive exception request APIs");
    permissionService.require("buyer:payment:register");
    tenantFeatureApplicationService.requireEnabled(tenantId, TenantFeatureKey.FINANCE);
    financeAccess.requireBatch(request.paymentBatchNo(), "buyer:payment:register");
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
    Map<String, Object> snapshot = new LinkedHashMap<>();
    snapshot.put("paymentBatchNo", savedRequest.paymentBatchNo());
    snapshot.put("exceptionType", savedRequest.exceptionType());
    snapshot.put("exceptionReason", savedRequest.exceptionReason());
    unifiedWorkflowApplicationService.start(new WorkflowStartCommand(
        ApprovalBusinessType.PAYMENT_ARCHIVE_EXCEPTION,
        savedRequest.id(),
        null,
        null,
        request.formData() == null ? Map.of() : request.formData(),
        snapshot));
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
    financeAccess.requireBatch(archiveExceptionRequest.paymentBatchNo(), "buyer:workflow:review");
    if (!ApprovalStatus.PENDING.equals(archiveExceptionRequest.approvalStatus())) {
      throw new IllegalStateException("Only pending payment archive exception requests can be reviewed: " + requestId);
    }
    var history = unifiedWorkflowApplicationService.completeCurrentUserBusinessTask(
        ApprovalBusinessType.PAYMENT_ARCHIVE_EXCEPTION,
        requestId,
        Boolean.TRUE.equals(request.approved()),
        request.comment());
    String status = "approved".equals(history.status())
        ? ApprovalStatus.APPROVED
        : "rejected".equals(history.status()) ? ApprovalStatus.REJECTED : "审批中";
    return new ApprovalTaskResponse(
        null,
        tenantId,
        ApprovalBusinessType.PAYMENT_ARCHIVE_EXCEPTION,
        requestId,
        userId,
        status,
        request.comment(),
        history.actedAt());
  }

  @Transactional
  public PaymentArchiveExceptionRequestResponse completeCurrentTenantPaymentArchiveExceptionAction(
      String requestId,
      CompletePaymentArchiveExceptionActionRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("payment archive exception request APIs");
    String userId = TenantAccessGuard.requireUserId("payment archive exception request APIs");
    permissionService.require("buyer:payment:register");
    tenantFeatureApplicationService.requireEnabled(tenantId, TenantFeatureKey.FINANCE);
    PaymentArchiveExceptionRequest archiveExceptionRequest =
        paymentArchiveExceptionRequestMapper.findByTenantAndId(tenantId, requestId);
    if (archiveExceptionRequest == null) {
      throw new IllegalArgumentException("Payment archive exception request not found in tenant scope: " + requestId);
    }
    financeAccess.requireBatch(archiveExceptionRequest.paymentBatchNo(), "buyer:payment:register");
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
    permissionService.require("buyer:payment:register");
    tenantFeatureApplicationService.requireEnabled(tenantId, TenantFeatureKey.FINANCE);
    PaymentArchiveExceptionRequest archiveExceptionRequest =
        paymentArchiveExceptionRequestMapper.findByTenantAndId(tenantId, requestId);
    if (archiveExceptionRequest == null) {
      throw new IllegalArgumentException("Payment archive exception request not found in tenant scope: " + requestId);
    }
    financeAccess.requireBatch(archiveExceptionRequest.paymentBatchNo(), "buyer:payment:register");
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

  private String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value;
  }
}
