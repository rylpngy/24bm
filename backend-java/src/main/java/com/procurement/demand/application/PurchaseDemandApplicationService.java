package com.procurement.demand.application;

import com.procurement.approval.domain.ApprovalTask;
import com.procurement.approval.infrastructure.ApprovalTaskMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.demand.api.ApprovalTaskResponse;
import com.procurement.demand.api.CreatePurchaseDemandRequest;
import com.procurement.demand.api.PurchaseDemandLineItemResponse;
import com.procurement.demand.api.PurchaseDemandResponse;
import com.procurement.demand.api.ReviewPurchaseDemandRequest;
import com.procurement.demand.domain.PurchaseDemand;
import com.procurement.demand.domain.PurchaseDemandItem;
import com.procurement.demand.infrastructure.PurchaseDemandItemMapper;
import com.procurement.demand.infrastructure.PurchaseDemandMapper;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PurchaseDemandApplicationService {
  private static final String DRAFT_STATUS = "草稿";
  private static final String IN_APPROVAL_STATUS = "审批中";
  private static final String PENDING_APPROVAL_STATUS = "待审批";
  private static final String APPROVED_STATUS = "已通过";
  private static final String REJECTED_STATUS = "已驳回";
  private static final String PURCHASE_DEMAND_BIZ_TYPE = "purchase_demand";
  private static final String PURCHASE_DEMAND_CREATED_ACTION = "purchase_demand.created";

  private final PurchaseDemandMapper purchaseDemandMapper;
  private final PurchaseDemandItemMapper purchaseDemandItemMapper;
  private final ApprovalTaskMapper approvalTaskMapper;
  private final AuditLogApplicationService auditLogApplicationService;

  public PurchaseDemandApplicationService(
      PurchaseDemandMapper purchaseDemandMapper,
      PurchaseDemandItemMapper purchaseDemandItemMapper,
      ApprovalTaskMapper approvalTaskMapper,
      AuditLogApplicationService auditLogApplicationService) {
    this.purchaseDemandMapper = purchaseDemandMapper;
    this.purchaseDemandItemMapper = purchaseDemandItemMapper;
    this.approvalTaskMapper = approvalTaskMapper;
    this.auditLogApplicationService = auditLogApplicationService;
  }

  public List<PurchaseDemandResponse> listCurrentTenantDemands() {
    String tenantId = TenantAccessGuard.requireTenantId("buyer demand APIs");
    return purchaseDemandMapper.listByTenant(tenantId).stream()
        .map(this::toResponse)
        .toList();
  }

  @Transactional
  public PurchaseDemandResponse create(CreatePurchaseDemandRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer demand APIs");
    String userId = TenantAccessGuard.requireUserId("buyer demand APIs");
    String demandId = newId("dem");

    purchaseDemandMapper.insert(
        demandId,
        tenantId,
        request.title(),
        request.departmentId(),
        userId,
        request.budget(),
        DRAFT_STATUS);

    for (var lineItem : request.lineItems()) {
      purchaseDemandItemMapper.insert(
          newId("dem-item"),
          tenantId,
          demandId,
          lineItem.materialId(),
          lineItem.quantity());
    }
    auditLogApplicationService.recordTenantAction(
        PURCHASE_DEMAND_CREATED_ACTION,
        PURCHASE_DEMAND_BIZ_TYPE,
        demandId);

    return toResponse(purchaseDemandMapper.findByTenantAndId(tenantId, demandId));
  }

  @Transactional
  public ApprovalTaskResponse submit(String demandId) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer demand APIs");
    PurchaseDemand demand = purchaseDemandMapper.findByTenantAndId(tenantId, demandId);
    if (demand == null) {
      throw new IllegalArgumentException("Purchase demand not found: " + demandId);
    }
    if (!DRAFT_STATUS.equals(demand.status())) {
      throw new IllegalStateException("Only draft purchase demands can be submitted: " + demandId);
    }

    purchaseDemandMapper.updateStatus(tenantId, demandId, IN_APPROVAL_STATUS);

    String approvalTaskId = newId("approval");
    approvalTaskMapper.insert(
        approvalTaskId,
        tenantId,
        PURCHASE_DEMAND_BIZ_TYPE,
        demandId,
        null,
        PENDING_APPROVAL_STATUS);

    ApprovalTask approvalTask = approvalTaskMapper.findByTenantAndId(tenantId, approvalTaskId);
    return new ApprovalTaskResponse(
        approvalTask.id(),
        approvalTask.tenantId(),
        approvalTask.bizType(),
        approvalTask.bizId(),
        approvalTask.assigneeId(),
        approvalTask.status(),
        approvalTask.createdAt());
  }

  @Transactional
  public ApprovalTaskResponse review(String demandId, ReviewPurchaseDemandRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer demand APIs");
    String userId = TenantAccessGuard.requireUserId("buyer demand APIs");
    PurchaseDemand demand = purchaseDemandMapper.findByTenantAndId(tenantId, demandId);
    if (demand == null) {
      throw new IllegalArgumentException("Purchase demand not found: " + demandId);
    }
    if (!IN_APPROVAL_STATUS.equals(demand.status())) {
      throw new IllegalStateException("Only in-approval purchase demands can be reviewed: " + demandId);
    }

    ApprovalTask approvalTask = approvalTaskMapper.findPendingByBiz(
        tenantId,
        PURCHASE_DEMAND_BIZ_TYPE,
        demandId,
        PENDING_APPROVAL_STATUS);
    if (approvalTask == null) {
      throw new IllegalStateException("Pending approval task not found for purchase demand: " + demandId);
    }

    String reviewedStatus = Boolean.TRUE.equals(request.approved()) ? APPROVED_STATUS : REJECTED_STATUS;
    int updated = approvalTaskMapper.updateStatus(
        tenantId,
        approvalTask.id(),
        PENDING_APPROVAL_STATUS,
        reviewedStatus,
        userId);
    if (updated == 0) {
      throw new IllegalStateException("Approval task status changed before review could be recorded: " + approvalTask.id());
    }
    purchaseDemandMapper.updateStatus(tenantId, demandId, reviewedStatus);

    ApprovalTask reviewedTask = approvalTaskMapper.findByTenantAndId(tenantId, approvalTask.id());
    return new ApprovalTaskResponse(
        reviewedTask.id(),
        reviewedTask.tenantId(),
        reviewedTask.bizType(),
        reviewedTask.bizId(),
        reviewedTask.assigneeId(),
        reviewedTask.status(),
        reviewedTask.createdAt());
  }

  private PurchaseDemandResponse toResponse(PurchaseDemand demand) {
    List<PurchaseDemandLineItemResponse> lineItems = purchaseDemandItemMapper
        .listByDemand(demand.tenantId(), demand.id())
        .stream()
        .map(this::toLineItemResponse)
        .toList();

    return new PurchaseDemandResponse(
        demand.id(),
        demand.tenantId(),
        demand.title(),
        demand.departmentId(),
        demand.requesterId(),
        demand.budget(),
        demand.status(),
        demand.createdAt(),
        demand.updatedAt(),
        lineItems);
  }

  private PurchaseDemandLineItemResponse toLineItemResponse(PurchaseDemandItem item) {
    return new PurchaseDemandLineItemResponse(item.id(), item.materialId(), item.quantity());
  }

  private String newId(String prefix) {
    return prefix + "-" + UUID.randomUUID();
  }
}
