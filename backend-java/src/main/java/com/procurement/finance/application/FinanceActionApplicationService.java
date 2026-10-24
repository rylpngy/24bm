package com.procurement.finance.application;

import com.procurement.identity.application.PermissionService;
import com.procurement.identity.domain.DataScope;
import com.procurement.approval.domain.ApprovalBusinessType;
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
import com.procurement.finance.api.UpdateVarianceHandlingStatusRequest;
import com.procurement.finance.api.VarianceHandlingResponse;
import com.procurement.common.api.ApprovalTaskResponse;
import com.procurement.finance.domain.Invoice;
import com.procurement.finance.domain.PaymentBatch;
import com.procurement.finance.domain.PaymentBatchStatus;
import com.procurement.finance.domain.PaymentBlockResolution;
import com.procurement.finance.domain.PaymentExecutionRecord;
import com.procurement.finance.domain.PaymentRequest;
import com.procurement.finance.domain.ThreeWayMatch;
import com.procurement.finance.domain.VarianceApprovalPolicy;
import com.procurement.finance.domain.ThreeWayMatchLineRow;
import com.procurement.finance.domain.VarianceHandling;
import com.procurement.finance.infrastructure.InvoiceMapper;
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
import com.procurement.workflow.application.UnifiedWorkflowApplicationService;
import com.procurement.workflow.application.WorkflowStartCommand;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FinanceActionApplicationService {

  private final InvoiceMapper invoiceMapper;
  private final PurchaseOrderMapper purchaseOrderMapper;
  private final PaymentBatchMapper paymentBatchMapper;
  private final PaymentBlockResolutionMapper paymentBlockResolutionMapper;
  private final PaymentExecutionRecordMapper paymentExecutionRecordMapper;
  private final PaymentRequestMapper paymentRequestMapper;
  private final ThreeWayMatchMapper threeWayMatchMapper;
  private final VarianceHandlingMapper varianceHandlingMapper;
  private final PaymentApplicationService paymentApplicationService;
  private final AuditLogApplicationService auditLogApplicationService;
  private final TenantFeatureApplicationService tenantFeatureApplicationService;
  private final PermissionService permissionService;
  private final FinanceAccessService financeAccess;
  private final UnifiedWorkflowApplicationService unifiedWorkflowApplicationService;
  private final PaymentBatchApplicationService paymentBatchService;
  private final PaymentArchiveExceptionApplicationService archiveExceptionService;

  @Autowired
  public FinanceActionApplicationService(
      InvoiceMapper invoiceMapper,
      PurchaseOrderMapper purchaseOrderMapper,
      PaymentBatchMapper paymentBatchMapper,
      PaymentBlockResolutionMapper paymentBlockResolutionMapper,
      PaymentExecutionRecordMapper paymentExecutionRecordMapper,
      PaymentRequestMapper paymentRequestMapper,
      ThreeWayMatchMapper threeWayMatchMapper,
      VarianceHandlingMapper varianceHandlingMapper,
      PaymentApplicationService paymentApplicationService,
      AuditLogApplicationService auditLogApplicationService,
      TenantFeatureApplicationService tenantFeatureApplicationService,
      PermissionService permissionService,
      FinanceAccessService financeAccess,
      UnifiedWorkflowApplicationService unifiedWorkflowApplicationService,
      PaymentBatchApplicationService paymentBatchService,
      PaymentArchiveExceptionApplicationService archiveExceptionService) {
    this.invoiceMapper = invoiceMapper;
    this.purchaseOrderMapper = purchaseOrderMapper;
    this.paymentBatchMapper = paymentBatchMapper;
    this.paymentBlockResolutionMapper = paymentBlockResolutionMapper;
    this.paymentExecutionRecordMapper = paymentExecutionRecordMapper;
    this.paymentRequestMapper = paymentRequestMapper;
    this.threeWayMatchMapper = threeWayMatchMapper;
    this.varianceHandlingMapper = varianceHandlingMapper;
    this.paymentApplicationService = paymentApplicationService;
    this.auditLogApplicationService = auditLogApplicationService;
    this.tenantFeatureApplicationService = tenantFeatureApplicationService;
    this.permissionService = permissionService;
    this.financeAccess = financeAccess;
    this.unifiedWorkflowApplicationService = java.util.Objects.requireNonNull(unifiedWorkflowApplicationService);
    this.paymentBatchService = paymentBatchService;
    this.archiveExceptionService = archiveExceptionService;
  }

  public List<PaymentBatchResponse> listCurrentTenantPaymentBatches(
      String batchStatus,
      String supplierId) {
    return paymentBatchService.listCurrentTenantPaymentBatches(batchStatus, supplierId);
  }

  public List<PaymentBlockResolutionResponse> listCurrentTenantPaymentBlockResolutions(
      String paymentBatchNo,
      String blockReason,
      String resolutionStatus,
      String invoiceId) {
    String tenantId = TenantAccessGuard.requireTenantId("payment block resolution APIs");
    DataScope scope = financeAccess.readScope();
    if (scope.blocksAll()) return List.of();
    return paymentBlockResolutionMapper.listVisible(
            tenantId,
            blankToNull(paymentBatchNo),
            blankToNull(blockReason),
            blankToNull(resolutionStatus),
            blankToNull(invoiceId), scope)
        .stream()
        .map(this::toPaymentBlockResolutionResponse)
        .toList();
  }

  public List<PaymentArchiveExceptionRequestResponse> listCurrentTenantPaymentArchiveExceptionRequests(
      String paymentBatchNo,
      String approvalStatus,
      String exceptionType) {
    return archiveExceptionService.listCurrentTenantPaymentArchiveExceptionRequests(paymentBatchNo, approvalStatus, exceptionType);
  }

  @Transactional
  public PaymentArchiveExceptionRequestResponse createCurrentTenantPaymentArchiveExceptionRequest(
      CreatePaymentArchiveExceptionRequestRequest request) {
    return archiveExceptionService.createCurrentTenantPaymentArchiveExceptionRequest(request);
  }

  @Transactional
  public ApprovalTaskResponse reviewCurrentTenantPaymentArchiveExceptionRequest(
      String requestId,
      ReviewPaymentArchiveExceptionRequest request) {
    return archiveExceptionService.reviewCurrentTenantPaymentArchiveExceptionRequest(requestId, request);
  }

  @Transactional
  public PaymentArchiveExceptionRequestResponse completeCurrentTenantPaymentArchiveExceptionAction(
      String requestId,
      CompletePaymentArchiveExceptionActionRequest request) {
    return archiveExceptionService.completeCurrentTenantPaymentArchiveExceptionAction(requestId, request);
  }

  @Transactional
  public PaymentArchiveExceptionRequestResponse closeCurrentTenantPaymentArchiveExceptionRequest(
      String requestId,
      ClosePaymentArchiveExceptionRequestRequest request) {
    return archiveExceptionService.closeCurrentTenantPaymentArchiveExceptionRequest(requestId, request);
  }

  @Transactional
  public PaymentBlockResolutionResponse createCurrentTenantPaymentBlockResolution(
      CreatePaymentBlockResolutionRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("payment block resolution APIs");
    String userId = TenantAccessGuard.requireUserId("payment block resolution APIs");
    permissionService.require("buyer:payment:register");
    tenantFeatureApplicationService.requireEnabled(tenantId, TenantFeatureKey.FINANCE);
    financeAccess.requireBatch(request.paymentBatchNo(), "buyer:payment:register");
    requirePaymentBatchNotArchived(tenantId, request.paymentBatchNo());
    validateBlockResolutionReferences(tenantId, request);
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
    permissionService.require("buyer:payment:register");
    tenantFeatureApplicationService.requireEnabled(tenantId, TenantFeatureKey.FINANCE);
    PaymentBlockResolution resolution = paymentBlockResolutionMapper.findByTenantAndId(tenantId, resolutionId);
    if (resolution == null) {
      throw new IllegalArgumentException("Payment block resolution not found in tenant scope: " + resolutionId);
    }
    financeAccess.requireBatch(resolution.paymentBatchNo(), "buyer:payment:register");
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
    DataScope scope = financeAccess.readScope();
    if (scope.blocksAll()) return List.of();
    paymentExecutionRecordMapper.refreshVisible(tenantId, scope);
    return paymentExecutionRecordMapper.listVisible(
            tenantId,
            blankToNull(paymentBatchNo),
            blankToNull(executionStatus),
            blankToNull(supplierId),
            blankToNull(invoiceId), scope)
        .stream()
        .map(this::toPaymentExecutionRecordResponse)
        .toList();
  }

  @Transactional
  public PaymentBatchResponse updateCurrentTenantPaymentBatchStatus(
      String paymentBatchNo,
      UpdatePaymentBatchStatusRequest request) {
    return paymentBatchService.updateCurrentTenantPaymentBatchStatus(paymentBatchNo, request);
  }

  private void requirePaymentBatchNotArchived(String tenantId, String paymentBatchNo) {
    PaymentBatch paymentBatch = paymentBatchMapper.findByTenantAndPaymentBatchNo(tenantId, paymentBatchNo);
    if (paymentBatch != null && "已付款归档".equals(paymentBatch.batchStatus())) {
      throw new IllegalStateException("Payment batch is archived and can only be audited: " + paymentBatchNo);
    }
  }

  @Transactional
  public PaymentExecutionRecordResponse registerCurrentTenantPaymentExecutionRecord(String executionRecordId) {
    return registerCurrentTenantPaymentExecutionRecord(
        executionRecordId,
        new RegisterPaymentRequest("已付款"));
  }

  @Transactional
  public PaymentExecutionRecordResponse registerCurrentTenantPaymentExecutionRecord(
      String executionRecordId,
      RegisterPaymentRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("payment execution record APIs");
    permissionService.require("buyer:payment:register");
    tenantFeatureApplicationService.requireEnabled(tenantId, TenantFeatureKey.FINANCE);
    RegisterPaymentRequest effectiveRequest =
        request == null ? new RegisterPaymentRequest("已付款") : request;
    PaymentExecutionRecord record = paymentExecutionRecordMapper.findByTenantAndId(tenantId, executionRecordId);
    if (record == null) {
      throw new IllegalArgumentException("Payment execution record not found in tenant scope: " + executionRecordId);
    }
    financeAccess.requireInvoice(record.invoiceId(), "buyer:payment:register");
    financeAccess.requireBatch(record.paymentBatchNo(), "buyer:payment:register");
    requirePaymentBatchNotArchived(tenantId, record.paymentBatchNo());
    requirePaymentBatchReadyForExecution(tenantId, record.paymentBatchNo());
    if (!record.executionStatus().equals("待登记付款")) {
      throw new IllegalStateException("Payment execution record is not ready for registration: " + executionRecordId);
    }
    paymentApplicationService.register(record.invoiceId(), effectiveRequest);
    paymentExecutionRecordMapper.refreshByTenantAndId(tenantId, executionRecordId);
    if (blankToNull(effectiveRequest.releaseEvidenceNo()) != null
        || blankToNull(effectiveRequest.releaseRemark()) != null) {
      paymentExecutionRecordMapper.markReleaseEvidence(
          tenantId,
          executionRecordId,
          blankToNull(effectiveRequest.releaseEvidenceNo()),
          blankToNull(effectiveRequest.releaseRemark()));
    }
    PaymentExecutionRecord refreshed = paymentExecutionRecordMapper.findByTenantAndId(tenantId, executionRecordId);
    return toPaymentExecutionRecordResponse(refreshed);
  }

  private void requirePaymentBatchReadyForExecution(String tenantId, String paymentBatchNo) {
    PaymentBatch paymentBatch = paymentBatchMapper.findByTenantAndPaymentBatchNo(tenantId, paymentBatchNo);
    if (paymentBatch == null) {
      throw new IllegalArgumentException("Payment batch not found in tenant scope: " + paymentBatchNo);
    }
    if (!"可安排付款".equals(paymentBatch.batchStatus())) {
      throw new IllegalStateException(
          "Payment batch must be approved before payment execution registration: " + paymentBatchNo);
    }
  }

  public List<ThreeWayMatchResponse> listCurrentTenantThreeWayMatches(
      String matchStatus,
      String supplierId,
      String orderId,
      String invoiceId) {
    String tenantId = TenantAccessGuard.requireTenantId("three-way match APIs");
    DataScope scope = financeAccess.readScope();
    if (scope.blocksAll()) return List.of();
    return threeWayMatchMapper.listVisible(
            tenantId,
            blankToNull(matchStatus),
            blankToNull(supplierId),
            blankToNull(orderId),
            blankToNull(invoiceId), scope)
        .stream()
        .map(this::toThreeWayMatchResponse)
        .toList();
  }

  // 行级三单匹配:给定发票,按订单行项逐行对照订单/收货/发票,标注金额差异与数量短缺。
  public List<ThreeWayMatchLineResponse> listCurrentTenantThreeWayMatchLines(String invoiceId) {
    String tenantId = TenantAccessGuard.requireTenantId("three-way match APIs");
    financeAccess.requireInvoice(invoiceId, "buyer:invoice:read");
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
    permissionService.require("buyer:payment:register");
    tenantFeatureApplicationService.requireEnabled(tenantId, TenantFeatureKey.FINANCE);
    var scope = financeAccess.requireScope("buyer:payment:register");
    var invoices = invoiceMapper.listVisible(tenantId, null, null, null, scope);
    for (var invoice : invoices) {
      threeWayMatchMapper.upsertFromInvoice("match-" + UUID.randomUUID(), tenantId, invoice.id());
    }
    int rebuiltCount = invoices.size();
    return new ThreeWayMatchRebuildResponse(tenantId, rebuiltCount);
  }

  @Transactional
  public VarianceHandlingResponse createVarianceHandlingFromThreeWayMatch(String matchId) {
    String tenantId = TenantAccessGuard.requireTenantId("three-way match APIs");
    String userId = TenantAccessGuard.requireUserId("three-way match APIs");
    permissionService.require("buyer:payment:register");
    tenantFeatureApplicationService.requireEnabled(tenantId, TenantFeatureKey.FINANCE);
    ThreeWayMatch match = threeWayMatchMapper.findByTenantAndId(tenantId, matchId);
    if (match == null) {
      throw new IllegalArgumentException("Three-way match not found in tenant scope: " + matchId);
    }
    financeAccess.requireInvoice(match.invoiceId(), "buyer:payment:register");
    if (!java.util.Set.of("金额差异", "履约待核验", "待收货").contains(match.matchStatus())) {
      throw new IllegalStateException("Only blocked three-way matches can create variance handling: " + matchId);
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
    permissionService.require("buyer:payment:register");
    tenantFeatureApplicationService.requireEnabled(tenantId, TenantFeatureKey.FINANCE);
    financeAccess.requireInvoice(invoiceId, "buyer:payment:register");
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
    DataScope scope = financeAccess.readScope();
    if (scope.blocksAll()) return List.of();
    return paymentRequestMapper.listVisible(
            tenantId,
            blankToNull(requestStatus),
            blankToNull(supplierId),
            blankToNull(orderId),
            blankToNull(invoiceId), scope)
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
    DataScope scope = financeAccess.readScope();
    if (scope.blocksAll()) return List.of();
    return varianceHandlingMapper.listVisible(
            tenantId,
            blankToNull(status),
            blankToNull(supplierId),
            blankToNull(orderId),
            blankToNull(invoiceId), scope)
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
    financeAccess.requireInvoice(request.invoiceId(), "buyer:payment:register");
    Invoice invoice = requireTenantInvoice(tenantId, request.invoiceId());
    ensureAmountVarianceHandledBeforePaymentRequest(tenantId, invoice);
    PaymentRequest existingRequest = paymentRequestMapper.findByTenantAndInvoice(tenantId, invoice.id());
    if (existingRequest != null) {
      financeAccess.requireBatch(existingRequest.paymentBatchNo(), "buyer:payment:register");
      requirePaymentRequestNotExecuted(tenantId, existingRequest);
      requirePaymentBatchNotArchived(tenantId, existingRequest.paymentBatchNo());
      requirePaymentBatchAcceptsRequestChanges(tenantId, existingRequest.paymentBatchNo());
      requirePaymentRequestEditable(existingRequest);
    }
    if (paymentBatchMapper.findByTenantAndPaymentBatchNo(tenantId, request.paymentBatchNo()) != null) {
      financeAccess.requireBatch(request.paymentBatchNo(), "buyer:payment:register");
    }
    requirePaymentBatchAcceptsRequestChanges(tenantId, request.paymentBatchNo());
    requirePaymentRequestInputStatus(request.requestStatus());
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
    if ("付款申请审批中".equals(request.requestStatus())) {
      startPaymentRequestWorkflow(savedRequest, request.formData());
      auditLogApplicationService.recordTenantAction(
          tenantId,
          "payment_request.submitted",
          AuditTargetType.INVOICE,
          savedRequest.invoiceId());
    }
    return toPaymentRequestResponse(savedRequest);
  }

  private void ensureAmountVarianceHandledBeforePaymentRequest(String tenantId, Invoice invoice) {
    String blockingReason = threeWayMatchMapper.paymentBlockingReason(tenantId, invoice.id());
    if (blockingReason != null) {
      throw new IllegalStateException("履约付款校验未通过：" + blockingReason);
    }
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
    permissionService.require("buyer:payment:register");
    tenantFeatureApplicationService.requireEnabled(tenantId, TenantFeatureKey.FINANCE);
    PaymentRequest paymentRequest = paymentRequestMapper.findByTenantAndId(tenantId, paymentRequestId);
    if (paymentRequest == null) {
      throw new IllegalArgumentException("Payment request not found in tenant scope: " + paymentRequestId);
    }
    financeAccess.requireInvoice(paymentRequest.invoiceId(), "buyer:payment:register");
    financeAccess.requireBatch(paymentRequest.paymentBatchNo(), "buyer:payment:register");
    requirePaymentBatchNotArchived(tenantId, paymentRequest.paymentBatchNo());
    requirePaymentRequestNotExecuted(tenantId, paymentRequest);
    requirePaymentBatchAcceptsRequestChanges(tenantId, paymentRequest.paymentBatchNo());
    requirePaymentRequestEditable(paymentRequest);
    requirePaymentRequestInputStatus(request.requestStatus());
    paymentRequestMapper.updateStatus(tenantId, paymentRequestId, request.requestStatus());
    syncPaymentBatch(tenantId, paymentRequest.paymentBatchNo());
    syncPaymentExecutionRecord(tenantId, paymentRequestId);
    if ("付款申请审批中".equals(request.requestStatus())) {
      startPaymentRequestWorkflow(paymentRequest, request.formData());
      auditLogApplicationService.recordTenantAction(
          tenantId,
          "payment_request.submitted",
          AuditTargetType.INVOICE,
          paymentRequest.invoiceId());
    }
    return toPaymentRequestResponse(paymentRequestMapper.findByTenantAndId(tenantId, paymentRequestId));
  }

  private void startPaymentRequestWorkflow(
      PaymentRequest paymentRequest, Map<String, Object> formData) {
    Map<String, Object> snapshot = new LinkedHashMap<>();
    snapshot.put("invoiceId", paymentRequest.invoiceId());
    snapshot.put("orderId", paymentRequest.orderId());
    snapshot.put("supplierId", paymentRequest.supplierId());
    snapshot.put("paymentBatchNo", paymentRequest.paymentBatchNo());
    unifiedWorkflowApplicationService.start(new WorkflowStartCommand(
        ApprovalBusinessType.PAYMENT_REQUEST,
        paymentRequest.id(),
        null,
        paymentRequest.amount(),
        formData == null ? Map.of() : formData,
        snapshot));
  }

  @Transactional
  public VarianceHandlingResponse createCurrentTenantVarianceHandling(CreateVarianceHandlingRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("variance handling APIs");
    String userId = TenantAccessGuard.requireUserId("variance handling APIs");
    permissionService.require("buyer:payment:register");
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
    permissionService.require("buyer:payment:register");
    tenantFeatureApplicationService.requireEnabled(tenantId, TenantFeatureKey.FINANCE);
    VarianceHandling varianceHandling = varianceHandlingMapper.findByTenantAndId(tenantId, varianceHandlingId);
    if (varianceHandling == null) {
      throw new IllegalArgumentException("Variance handling not found in tenant scope: " + varianceHandlingId);
    }
    financeAccess.requireInvoice(varianceHandling.invoiceId(), "buyer:payment:register");
    PaymentRequest linkedPaymentRequest =
        paymentRequestMapper.findByTenantAndInvoice(tenantId, varianceHandling.invoiceId());
    if (linkedPaymentRequest != null) {
      requirePaymentBatchNotArchived(tenantId, linkedPaymentRequest.paymentBatchNo());
    }
    String result = request.result() == null || request.result().isBlank()
        ? varianceHandling.result()
        : request.result();
    String status = request.status();
    if (VarianceApprovalPolicy.STATUS_RESOLVED.equals(status)
        && (request.result() == null || request.result().isBlank())) {
      throw new IllegalArgumentException("差异结案须填写本次核实的处置结果及凭据，不能沿用默认结果");
    }
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
    financeAccess.requireInvoice(varianceHandling.invoiceId(), "buyer:variance:approve");
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

  private void requirePaymentBatchAcceptsRequestChanges(String tenantId, String paymentBatchNo) {
    PaymentBatch paymentBatch = paymentBatchMapper.findByTenantAndPaymentBatchNo(tenantId, paymentBatchNo);
    if (paymentBatch == null || PaymentBatchStatus.acceptsPaymentRequestChanges(paymentBatch.batchStatus())) {
      return;
    }
    throw new IllegalStateException(
        "Payment batch cannot be changed after batch approval has started: " + paymentBatchNo);
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

  private void requirePaymentRequestEditable(PaymentRequest request) {
    if (!"付款申请待提交".equals(request.requestStatus())
        && !"付款申请已驳回".equals(request.requestStatus())) {
      throw new IllegalStateException("审批中或已通过的付款申请不可修改，请通过工作流办理");
    }
  }

  private void requirePaymentRequestInputStatus(String status) {
    if (!"付款申请待提交".equals(status) && !"付款申请审批中".equals(status)) {
      throw new IllegalStateException("付款申请只能保存草稿或提交审批，审批结果由 Flowable 回写");
    }
  }

  private Invoice requireTenantInvoice(String tenantId, String invoiceId) {
    financeAccess.requireInvoice(invoiceId, "buyer:payment:register");
    Invoice invoice = invoiceMapper.findByTenantAndId(tenantId, invoiceId);
    if (invoice == null) {
      throw new IllegalArgumentException("Invoice not found in tenant scope: " + invoiceId);
    }
    return invoice;
  }

  private void validateBlockResolutionReferences(String tenantId, CreatePaymentBlockResolutionRequest request) {
    PaymentRequest linked = blankToNull(request.paymentRequestId()) == null ? null
        : paymentRequestMapper.findByTenantAndId(tenantId, request.paymentRequestId());
    if (blankToNull(request.paymentRequestId()) != null
        && (linked == null || !request.paymentBatchNo().equals(linked.paymentBatchNo()))) {
      throw new IllegalArgumentException("付款申请不属于所选批次");
    }
    if (blankToNull(request.invoiceId()) != null) {
      financeAccess.requireInvoice(request.invoiceId(), "buyer:payment:register");
      PaymentRequest invoiceRequest = paymentRequestMapper.findByTenantAndInvoice(tenantId, request.invoiceId());
      if (invoiceRequest == null || !request.paymentBatchNo().equals(invoiceRequest.paymentBatchNo())
          || (linked != null && !linked.id().equals(invoiceRequest.id()))) {
        throw new IllegalArgumentException("发票与付款申请、批次不一致");
      }
      linked = invoiceRequest;
    }
    if (blankToNull(request.supplierId()) != null) {
      String supplier = linked == null
          ? paymentBatchMapper.findByTenantAndPaymentBatchNo(tenantId, request.paymentBatchNo()).supplierId()
          : linked.supplierId();
      if (!request.supplierId().equals(supplier)) {
        throw new IllegalArgumentException("供应商与付款申请、批次不一致");
      }
    }
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
        record.releaseEvidenceNo(),
        record.releaseRemark(),
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
