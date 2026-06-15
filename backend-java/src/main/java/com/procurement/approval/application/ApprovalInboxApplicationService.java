package com.procurement.approval.application;

import com.procurement.approval.api.PendingApprovalTaskResponse;
import com.procurement.approval.domain.ApprovalTask;
import com.procurement.approval.infrastructure.ApprovalTaskMapper;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.demand.domain.PurchaseDemand;
import com.procurement.demand.infrastructure.PurchaseDemandMapper;
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
  private static final String PENDING_APPROVAL_STATUS = "待审批";
  private static final String PURCHASE_DEMAND_BIZ_TYPE = "purchase_demand";
  private static final String BUYER_SUPPLIER_ADMISSION_BIZ_TYPE = "buyer_supplier_admission";
  private static final String RFQ_AWARD_BIZ_TYPE = "rfq_award";

  private final ApprovalTaskMapper approvalTaskMapper;
  private final PurchaseDemandMapper purchaseDemandMapper;
  private final BuyerSupplierRelationMapper buyerSupplierRelationMapper;
  private final AwardDecisionMapper awardDecisionMapper;
  private final RfqMapper rfqMapper;

  public ApprovalInboxApplicationService(
      ApprovalTaskMapper approvalTaskMapper,
      PurchaseDemandMapper purchaseDemandMapper,
      BuyerSupplierRelationMapper buyerSupplierRelationMapper,
      AwardDecisionMapper awardDecisionMapper,
      RfqMapper rfqMapper) {
    this.approvalTaskMapper = approvalTaskMapper;
    this.purchaseDemandMapper = purchaseDemandMapper;
    this.buyerSupplierRelationMapper = buyerSupplierRelationMapper;
    this.awardDecisionMapper = awardDecisionMapper;
    this.rfqMapper = rfqMapper;
  }

  public List<PendingApprovalTaskResponse> listPending() {
    String tenantId = TenantAccessGuard.requireTenantId("buyer approval inbox APIs");
    return approvalTaskMapper.listByTenantAndStatus(tenantId, PENDING_APPROVAL_STATUS).stream()
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
        summary.amount(),
        summary.counterpartyId(),
        summary.counterpartyName(),
        task.assigneeId(),
        task.status(),
        task.createdAt());
  }

  private ApprovalTaskSummary summaryFor(ApprovalTask task) {
    return switch (task.bizType()) {
      case PURCHASE_DEMAND_BIZ_TYPE -> purchaseDemandSummary(task);
      case BUYER_SUPPLIER_ADMISSION_BIZ_TYPE -> buyerSupplierAdmissionSummary(task);
      case RFQ_AWARD_BIZ_TYPE -> rfqAwardSummary(task);
      default -> ApprovalTaskSummary.empty();
    };
  }

  private ApprovalTaskSummary purchaseDemandSummary(ApprovalTask task) {
    PurchaseDemand demand = purchaseDemandMapper.findByTenantAndId(task.tenantId(), task.bizId());
    if (demand == null) {
      return ApprovalTaskSummary.empty();
    }
    return new ApprovalTaskSummary(null, demand.title(), demand.budget(), null, null);
  }

  private ApprovalTaskSummary buyerSupplierAdmissionSummary(ApprovalTask task) {
    BuyerSupplierRelation relation = buyerSupplierRelationMapper.findByTenantAndId(task.tenantId(), task.bizId());
    if (relation == null) {
      return ApprovalTaskSummary.empty();
    }
    return new ApprovalTaskSummary(
        null,
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
    return new ApprovalTaskSummary(
        awardDecision.rfqId(),
        rfq == null ? "" : rfq.title(),
        awardDecision.amount(),
        awardDecision.supplierId(),
        null);
  }

  private record ApprovalTaskSummary(
      String parentBizId,
      String title,
      BigDecimal amount,
      String counterpartyId,
      String counterpartyName) {
    private static ApprovalTaskSummary empty() {
      return new ApprovalTaskSummary(null, "", null, null, null);
    }
  }
}
