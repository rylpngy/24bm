package com.procurement.finance.application;

import com.procurement.identity.application.PermissionService;
import com.procurement.identity.domain.DataScope;
import com.procurement.approval.domain.ApprovalBusinessType;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.domain.AuditTargetType;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.finance.api.PaymentBatchResponse;
import com.procurement.finance.api.UpdatePaymentBatchStatusRequest;
import com.procurement.finance.domain.PaymentBatch;
import com.procurement.finance.domain.PaymentBatchStatus;
import com.procurement.finance.infrastructure.PaymentBatchMapper;
import com.procurement.finance.infrastructure.PaymentExecutionRecordMapper;
import com.procurement.tenant.application.TenantFeatureApplicationService;
import com.procurement.tenant.domain.TenantFeatureKey;
import com.procurement.workflow.application.UnifiedWorkflowApplicationService;
import com.procurement.workflow.application.WorkflowStartCommand;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PaymentBatchApplicationService {
  private final PaymentBatchMapper paymentBatchMapper;
  private final PaymentExecutionRecordMapper paymentExecutionRecordMapper;
  private final AuditLogApplicationService auditLogApplicationService;
  private final TenantFeatureApplicationService tenantFeatureApplicationService;
  private final PermissionService permissionService;
  private final FinanceAccessService financeAccess;
  private final UnifiedWorkflowApplicationService unifiedWorkflowApplicationService;

  public PaymentBatchApplicationService(
      PaymentBatchMapper paymentBatchMapper,
      PaymentExecutionRecordMapper paymentExecutionRecordMapper,
      AuditLogApplicationService auditLogApplicationService,
      TenantFeatureApplicationService tenantFeatureApplicationService,
      PermissionService permissionService,
      FinanceAccessService financeAccess,
      UnifiedWorkflowApplicationService unifiedWorkflowApplicationService) {
    this.paymentBatchMapper = paymentBatchMapper;
    this.paymentExecutionRecordMapper = paymentExecutionRecordMapper;
    this.auditLogApplicationService = auditLogApplicationService;
    this.tenantFeatureApplicationService = tenantFeatureApplicationService;
    this.permissionService = permissionService;
    this.financeAccess = financeAccess;
    this.unifiedWorkflowApplicationService = java.util.Objects.requireNonNull(unifiedWorkflowApplicationService);
  }

  public List<PaymentBatchResponse> listCurrentTenantPaymentBatches(
      String batchStatus,
      String supplierId) {
    String tenantId = TenantAccessGuard.requireTenantId("payment batch APIs");
    DataScope scope = financeAccess.readScope();
    if (scope.blocksAll()) return List.of();
    paymentExecutionRecordMapper.refreshVisible(tenantId, scope);
    return paymentBatchMapper.listVisible(
            tenantId,
            blankToNull(batchStatus),
            blankToNull(supplierId),
            scope)
        .stream()
        .map(this::toPaymentBatchResponse)
        .toList();
  }

  @Transactional
  public PaymentBatchResponse updateCurrentTenantPaymentBatchStatus(
      String paymentBatchNo,
      UpdatePaymentBatchStatusRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("payment batch APIs");
    permissionService.require("buyer:payment:register");
    tenantFeatureApplicationService.requireEnabled(tenantId, TenantFeatureKey.FINANCE);
    PaymentBatch paymentBatch = paymentBatchMapper.findByTenantAndPaymentBatchNo(tenantId, paymentBatchNo);
    if (paymentBatch == null) {
      throw new IllegalArgumentException("Payment batch not found in tenant scope: " + paymentBatchNo);
    }
    financeAccess.requireBatch(paymentBatchNo, "buyer:payment:register");
    if (PaymentBatchStatus.ARCHIVED.equals(paymentBatch.batchStatus())
        && !PaymentBatchStatus.ARCHIVED.equals(request.batchStatus())) {
      requirePaymentBatchNotArchived(tenantId, paymentBatchNo);
    }
    if (PaymentBatchStatus.APPROVAL_IN_PROGRESS.equals(request.batchStatus())
        || PaymentBatchStatus.READY_FOR_PAYMENT.equals(request.batchStatus())) {
      requirePaymentBatchRequestsApproved(paymentBatch);
    }
    PaymentBatchStatus.requireManualTransition(paymentBatch.batchStatus(), request.batchStatus());
    if (PaymentBatchStatus.ARCHIVED.equals(request.batchStatus())) {
      paymentExecutionRecordMapper.refreshVisible(tenantId, financeAccess.requireScope("buyer:payment:register"));
      requirePaymentBatchArchiveReady(tenantId, paymentBatchNo);
    }
    if (PaymentBatchStatus.READY_FOR_PAYMENT.equals(request.batchStatus())) {
      throw new IllegalStateException("Payment batch approval outcome can only be applied by Flowable workflow tasks");
    }
    paymentBatchMapper.updateStatus(tenantId, paymentBatchNo, request.batchStatus());
    paymentExecutionRecordMapper.refreshVisible(tenantId, financeAccess.requireScope("buyer:payment:register"));
    if (PaymentBatchStatus.APPROVAL_IN_PROGRESS.equals(request.batchStatus())) {
      Map<String, Object> snapshot = new LinkedHashMap<>();
      snapshot.put("paymentBatchNo", paymentBatch.paymentBatchNo());
      snapshot.put("supplierId", paymentBatch.supplierId());
      snapshot.put("requestCount", paymentBatch.requestCount());
      snapshot.put("totalAmount", paymentBatch.totalAmount());
      unifiedWorkflowApplicationService.start(new WorkflowStartCommand(
          ApprovalBusinessType.PAYMENT_BATCH,
          paymentBatchNo,
          null,
          paymentBatch.totalAmount(),
          request.formData() == null ? Map.of() : request.formData(),
          snapshot));
      auditLogApplicationService.recordTenantAction(
          tenantId,
          "payment_batch.submitted",
          AuditTargetType.PAYMENT_BATCH,
          paymentBatchNo);
    } else if (PaymentBatchStatus.ARCHIVED.equals(request.batchStatus())) {
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

  private void requirePaymentBatchNotArchived(String tenantId, String paymentBatchNo) {
    PaymentBatch paymentBatch = paymentBatchMapper.findByTenantAndPaymentBatchNo(tenantId, paymentBatchNo);
    if (paymentBatch != null && "已付款归档".equals(paymentBatch.batchStatus())) {
      throw new IllegalStateException("Payment batch is archived and can only be audited: " + paymentBatchNo);
    }
  }

  private String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value;
  }
}
