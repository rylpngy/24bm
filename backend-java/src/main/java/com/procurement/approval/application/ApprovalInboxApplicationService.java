package com.procurement.approval.application;

import com.procurement.approval.api.PendingApprovalTaskResponse;
import com.procurement.approval.domain.ApprovalBusinessType;
import com.procurement.approval.domain.ApprovalStatus;
import com.procurement.approval.domain.ApprovalTask;
import com.procurement.approval.infrastructure.ApprovalTaskMapper;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.contract.domain.ContractLedger;
import com.procurement.contract.infrastructure.ContractMapper;
import com.procurement.demand.domain.PurchaseDemand;
import com.procurement.demand.infrastructure.PurchaseDemandMapper;
import com.procurement.finance.domain.PaymentBatch;
import com.procurement.finance.domain.PaymentArchiveExceptionRequest;
import com.procurement.finance.domain.PaymentRequest;
import com.procurement.finance.infrastructure.PaymentArchiveExceptionRequestMapper;
import com.procurement.finance.infrastructure.PaymentBatchMapper;
import com.procurement.finance.infrastructure.PaymentRequestMapper;
import com.procurement.identity.domain.BuyerUser;
import com.procurement.identity.infrastructure.BuyerUserMapper;
import com.procurement.sourcing.domain.AwardDecision;
import com.procurement.sourcing.domain.Rfq;
import com.procurement.sourcing.infrastructure.AwardDecisionMapper;
import com.procurement.sourcing.infrastructure.RfqMapper;
import com.procurement.supplier.domain.BuyerSupplierRelation;
import com.procurement.supplier.infrastructure.BuyerSupplierRelationMapper;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class ApprovalInboxApplicationService {
  private static final int RECENT_REVIEW_LIMIT = 10;

  private final ApprovalTaskMapper approvalTaskMapper;
  private final PurchaseDemandMapper purchaseDemandMapper;
  private final BuyerSupplierRelationMapper buyerSupplierRelationMapper;
  private final AwardDecisionMapper awardDecisionMapper;
  private final RfqMapper rfqMapper;
  private final PaymentRequestMapper paymentRequestMapper;
  private final PaymentBatchMapper paymentBatchMapper;
  private final PaymentArchiveExceptionRequestMapper paymentArchiveExceptionRequestMapper;
  private final ContractMapper contractMapper;
  private final BuyerUserMapper buyerUserMapper;

  public ApprovalInboxApplicationService(
      ApprovalTaskMapper approvalTaskMapper,
      PurchaseDemandMapper purchaseDemandMapper,
      BuyerSupplierRelationMapper buyerSupplierRelationMapper,
      AwardDecisionMapper awardDecisionMapper,
      RfqMapper rfqMapper,
      PaymentRequestMapper paymentRequestMapper,
      PaymentBatchMapper paymentBatchMapper,
      PaymentArchiveExceptionRequestMapper paymentArchiveExceptionRequestMapper,
      ContractMapper contractMapper,
      BuyerUserMapper buyerUserMapper) {
    this.approvalTaskMapper = approvalTaskMapper;
    this.purchaseDemandMapper = purchaseDemandMapper;
    this.buyerSupplierRelationMapper = buyerSupplierRelationMapper;
    this.awardDecisionMapper = awardDecisionMapper;
    this.rfqMapper = rfqMapper;
    this.paymentRequestMapper = paymentRequestMapper;
    this.paymentBatchMapper = paymentBatchMapper;
    this.paymentArchiveExceptionRequestMapper = paymentArchiveExceptionRequestMapper;
    this.contractMapper = contractMapper;
    this.buyerUserMapper = buyerUserMapper;
  }

  public List<PendingApprovalTaskResponse> listPending() {
    String tenantId = TenantAccessGuard.requireTenantId("buyer approval inbox APIs");
    return approvalTaskMapper.listByTenantAndStatus(tenantId, ApprovalStatus.PENDING).stream()
        .map(this::toResponse)
        .toList();
  }

  public List<PendingApprovalTaskResponse> listRecentReviewed() {
    String tenantId = TenantAccessGuard.requireTenantId("buyer approval inbox APIs");
    return approvalTaskMapper.listRecentReviewedByTenant(tenantId, RECENT_REVIEW_LIMIT).stream()
        .map(this::toResponse)
        .toList();
  }

  private PendingApprovalTaskResponse toResponse(ApprovalTask task) {
    ApprovalTaskSummary summary = summaryFor(task);
    return new PendingApprovalTaskResponse(
        task.id(),
        task.tenantId(),
        task.bizType(),
        task.bizId(),
        summary.parentBizId(),
        summary.title(),
        summary.businessStatus(),
        priorityFor(task.bizType()),
        summary.submittedById(),
        summary.submittedByName(),
        summary.amount(),
        summary.counterpartyId(),
        summary.counterpartyName(),
        task.assigneeId(),
        task.status(),
        task.reviewComment(),
        task.createdAt(),
        task.actedAt());
  }

  private ApprovalTaskSummary summaryFor(ApprovalTask task) {
    return switch (task.bizType()) {
      case ApprovalBusinessType.PURCHASE_DEMAND -> purchaseDemandSummary(task);
      case ApprovalBusinessType.BUYER_SUPPLIER_ADMISSION -> buyerSupplierAdmissionSummary(task);
      case ApprovalBusinessType.RFQ_AWARD -> rfqAwardSummary(task);
      case ApprovalBusinessType.PAYMENT_REQUEST -> paymentRequestSummary(task);
      case ApprovalBusinessType.PAYMENT_BATCH -> paymentBatchSummary(task);
      case ApprovalBusinessType.PAYMENT_ARCHIVE_EXCEPTION -> paymentArchiveExceptionSummary(task);
      case ApprovalBusinessType.CONTRACT_APPROVAL -> contractApprovalSummary(task);
      default -> ApprovalTaskSummary.empty();
    };
  }

  private Integer priorityFor(String bizType) {
    return switch (bizType) {
      case ApprovalBusinessType.RFQ_AWARD -> 90;
      case ApprovalBusinessType.PAYMENT_ARCHIVE_EXCEPTION -> 89;
      case ApprovalBusinessType.PAYMENT_BATCH -> 88;
      case ApprovalBusinessType.CONTRACT_APPROVAL -> 86;
      case ApprovalBusinessType.PAYMENT_REQUEST -> 85;
      case ApprovalBusinessType.BUYER_SUPPLIER_ADMISSION -> 80;
      case ApprovalBusinessType.PURCHASE_DEMAND -> 70;
      default -> 50;
    };
  }

  private ApprovalTaskSummary purchaseDemandSummary(ApprovalTask task) {
    PurchaseDemand demand = purchaseDemandMapper.findByTenantAndId(task.tenantId(), task.bizId());
    if (demand == null) {
      return ApprovalTaskSummary.empty();
    }
    BuyerUser requester = buyerUserMapper.findByTenantAndId(task.tenantId(), demand.requesterId());
    return new ApprovalTaskSummary(
        null,
        demand.title(),
        demand.status(),
        demand.requesterId(),
        requester == null ? demand.requesterId() : requester.name(),
        demand.budget(),
        null,
        null);
  }

  private ApprovalTaskSummary buyerSupplierAdmissionSummary(ApprovalTask task) {
    BuyerSupplierRelation relation = buyerSupplierRelationMapper.findByTenantAndId(task.tenantId(), task.bizId());
    if (relation == null) {
      return ApprovalTaskSummary.empty();
    }
    return new ApprovalTaskSummary(
        null,
        relation.supplierName(),
        relation.status(),
        relation.supplierId(),
        relation.supplierName(),
        null,
        relation.supplierId(),
        relation.supplierName());
  }

  private ApprovalTaskSummary rfqAwardSummary(ApprovalTask task) {
    AwardDecision awardDecision = awardDecisionMapper.findByTenantAndId(task.tenantId(), task.bizId());
    if (awardDecision == null) {
      return ApprovalTaskSummary.empty();
    }
    Rfq rfq = rfqMapper.findByTenantAndId(task.tenantId(), awardDecision.rfqId());
    BuyerUser owner = rfq == null ? null : buyerUserMapper.findByTenantAndId(task.tenantId(), rfq.ownerId());
    return new ApprovalTaskSummary(
        awardDecision.rfqId(),
        rfq == null ? "" : rfq.title(),
        rfq == null ? "" : rfq.status(),
        rfq == null ? null : rfq.ownerId(),
        rfq == null ? null : owner == null ? rfq.ownerId() : owner.name(),
        awardDecision.amount(),
        awardDecision.supplierId(),
        null);
  }

  private ApprovalTaskSummary paymentRequestSummary(ApprovalTask task) {
    PaymentRequest paymentRequest = paymentRequestMapper.findByTenantAndId(task.tenantId(), task.bizId());
    if (paymentRequest == null) {
      return ApprovalTaskSummary.empty();
    }
    BuyerUser requester = buyerUserMapper.findByTenantAndId(task.tenantId(), paymentRequest.createdBy());
    return new ApprovalTaskSummary(
        paymentRequest.invoiceId(),
        "付款申请 " + paymentRequest.paymentBatchNo(),
        paymentRequest.requestStatus(),
        paymentRequest.createdBy(),
        requester == null ? paymentRequest.createdBy() : requester.name(),
        paymentRequest.amount(),
        paymentRequest.supplierId(),
        paymentRequest.supplierId());
  }

  private ApprovalTaskSummary paymentBatchSummary(ApprovalTask task) {
    PaymentBatch paymentBatch = paymentBatchMapper.findByTenantAndPaymentBatchNo(task.tenantId(), task.bizId());
    if (paymentBatch == null) {
      return ApprovalTaskSummary.empty();
    }
    String supplierId = paymentBatch.supplierId();
    return new ApprovalTaskSummary(
        null,
        "付款批次 " + paymentBatch.paymentBatchNo(),
        paymentBatch.batchStatus(),
        supplierId,
        supplierId == null ? null : "供应商 " + supplierId,
        paymentBatch.totalAmount(),
        supplierId,
        supplierId == null ? null : "供应商 " + supplierId);
  }

  private ApprovalTaskSummary paymentArchiveExceptionSummary(ApprovalTask task) {
    PaymentArchiveExceptionRequest request = paymentArchiveExceptionRequestMapper.findByTenantAndId(
        task.tenantId(),
        task.bizId());
    if (request == null) {
      return ApprovalTaskSummary.empty();
    }
    BuyerUser requester = buyerUserMapper.findByTenantAndId(task.tenantId(), request.requestedBy());
    return new ApprovalTaskSummary(
        request.paymentBatchNo(),
        "付款归档异常 " + request.paymentBatchNo(),
        request.exceptionType() + " / " + task.status(),
        request.requestedBy(),
        requester == null ? request.requestedBy() : requester.name(),
        null,
        request.paymentBatchNo(),
        request.paymentBatchNo());
  }

  private ApprovalTaskSummary contractApprovalSummary(ApprovalTask task) {
    ContractLedger contract = contractMapper.findByTenantAndId(task.tenantId(), task.bizId());
    if (contract == null) {
      return ApprovalTaskSummary.empty();
    }
    return new ApprovalTaskSummary(
        contract.relatedOrderId(),
        contract.contractName(),
        contract.status(),
        contract.supplierId(),
        "供应商 " + contract.supplierId(),
        contract.amount(),
        contract.supplierId(),
        "供应商 " + contract.supplierId());
  }

  private record ApprovalTaskSummary(
      String parentBizId,
      String title,
      String businessStatus,
      String submittedById,
      String submittedByName,
      BigDecimal amount,
      String counterpartyId,
      String counterpartyName) {
    private static ApprovalTaskSummary empty() {
      return new ApprovalTaskSummary(null, "", "", null, null, null, null, null);
    }
  }
}
