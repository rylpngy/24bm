package com.procurement.demand.application;

import com.procurement.approval.domain.ApprovalTask;
import com.procurement.approval.application.ApprovalTaskApplicationService;
import com.procurement.approval.domain.ApprovalStatus;
import com.procurement.approval.infrastructure.ApprovalTaskMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.demand.api.ApprovalTaskResponse;
import com.procurement.demand.api.CreatePurchaseDemandRequest;
import com.procurement.demand.api.PurchaseDemandLineItemResponse;
import com.procurement.demand.api.PurchaseDemandResponse;
import com.procurement.demand.api.ReviewPurchaseDemandRequest;
import com.procurement.demand.domain.PurchaseDemand;
import com.procurement.demand.domain.PurchaseDemandApprovalStatusTransition;
import com.procurement.demand.domain.PurchaseDemandItem;
import com.procurement.demand.domain.PurchaseDemandStatus;
import com.procurement.demand.infrastructure.PurchaseDemandItemMapper;
import com.procurement.demand.infrastructure.PurchaseDemandMapper;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.organization.infrastructure.DepartmentMapper;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PurchaseDemandApplicationService {
  private static final String PURCHASE_DEMAND_BIZ_TYPE = "purchase_demand";
  private static final String PURCHASE_DEMAND_CREATED_ACTION = "purchase_demand.created";
  private static final String PURCHASE_DEMAND_APPROVED_ACTION = "purchase_demand.approved";
  private static final String PURCHASE_DEMAND_REJECTED_ACTION = "purchase_demand.rejected";
  private static final String PURCHASE_DEMAND_PENDING_NOTIFICATION_TITLE = "采购需求待审批";
  private static final String PURCHASE_DEMAND_APPROVED_NOTIFICATION_TITLE = "采购需求审批已通过";
  private static final String PURCHASE_DEMAND_REJECTED_NOTIFICATION_TITLE = "采购需求审批已驳回";

  private final PurchaseDemandMapper purchaseDemandMapper;
  private final PurchaseDemandItemMapper purchaseDemandItemMapper;
  private final ApprovalTaskMapper approvalTaskMapper;
  private final ApprovalTaskApplicationService approvalTaskApplicationService;
  private final DepartmentMapper departmentMapper;
  private final AuditLogApplicationService auditLogApplicationService;
  private final NotificationApplicationService notificationApplicationService;
  private final PurchaseDemandApprovalStatusTransition purchaseDemandApprovalStatusTransition;

  public PurchaseDemandApplicationService(
      PurchaseDemandMapper purchaseDemandMapper,
      PurchaseDemandItemMapper purchaseDemandItemMapper,
      ApprovalTaskMapper approvalTaskMapper,
      ApprovalTaskApplicationService approvalTaskApplicationService,
      DepartmentMapper departmentMapper,
      AuditLogApplicationService auditLogApplicationService,
      NotificationApplicationService notificationApplicationService,
      PurchaseDemandApprovalStatusTransition purchaseDemandApprovalStatusTransition) {
    this.purchaseDemandMapper = purchaseDemandMapper;
    this.purchaseDemandItemMapper = purchaseDemandItemMapper;
    this.approvalTaskMapper = approvalTaskMapper;
    this.approvalTaskApplicationService = approvalTaskApplicationService;
    this.departmentMapper = departmentMapper;
    this.auditLogApplicationService = auditLogApplicationService;
    this.notificationApplicationService = notificationApplicationService;
    this.purchaseDemandApprovalStatusTransition = purchaseDemandApprovalStatusTransition;
  }

  public List<PurchaseDemandResponse> listCurrentTenantDemands() {
    String tenantId = TenantAccessGuard.requireTenantId("buyer demand APIs");
    return purchaseDemandMapper.listByTenant(tenantId).stream()
        .map(this::toResponse)
        .toList();
  }

  public List<PurchaseDemandResponse> listCurrentTenantDemands(
      String status,
      String departmentId,
      String keyword) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer demand APIs");
    return purchaseDemandMapper.listByTenantFiltered(
            tenantId,
            blankToNull(status),
            blankToNull(departmentId),
            blankToNull(keyword))
        .stream()
        .map(this::toResponse)
        .toList();
  }

  @Transactional
  public PurchaseDemandResponse create(CreatePurchaseDemandRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer demand APIs");
    String userId = TenantAccessGuard.requireUserId("buyer demand APIs");
    requireActiveDepartment(tenantId, request.departmentId());
    String demandId = newId("dem");

    purchaseDemandMapper.insert(
        demandId,
        tenantId,
        request.title(),
        request.departmentId(),
        userId,
        request.budget(),
        PurchaseDemandStatus.DRAFT);

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
    purchaseDemandApprovalStatusTransition.requireSubmission(demand.status(), demandId);

    purchaseDemandMapper.updateStatus(tenantId, demandId, PurchaseDemandStatus.IN_APPROVAL);

    ApprovalTask approvalTask = approvalTaskApplicationService.createPendingTask(
        tenantId,
        PURCHASE_DEMAND_BIZ_TYPE,
        demandId,
        null);
    notificationApplicationService.notifyActiveTenantUsers(
        tenantId,
        PURCHASE_DEMAND_PENDING_NOTIFICATION_TITLE,
        demand.title() + "已提交审批，请及时处理。");

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
    purchaseDemandApprovalStatusTransition.requireReview(demand.status(), demandId);

    ApprovalTask approvalTask = approvalTaskMapper.findPendingByBiz(
        tenantId,
        PURCHASE_DEMAND_BIZ_TYPE,
        demandId,
        ApprovalStatus.PENDING);
    if (approvalTask == null) {
      throw new IllegalStateException("Pending approval task not found for purchase demand: " + demandId);
    }

    String approvalStatus = Boolean.TRUE.equals(request.approved()) ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED;
    boolean approved = Boolean.TRUE.equals(request.approved());
    String demandStatus = purchaseDemandApprovalStatusTransition.reviewTargetStatus(approved);
    int updated = approvalTaskMapper.updateStatus(
        tenantId,
        approvalTask.id(),
        ApprovalStatus.PENDING,
        approvalStatus,
        userId);
    if (updated == 0) {
      throw new IllegalStateException("Approval task status changed before review could be recorded: " + approvalTask.id());
    }
    purchaseDemandMapper.updateStatus(tenantId, demandId, demandStatus);
    auditLogApplicationService.recordTenantAction(
        approved ? PURCHASE_DEMAND_APPROVED_ACTION : PURCHASE_DEMAND_REJECTED_ACTION,
        PURCHASE_DEMAND_BIZ_TYPE,
        demandId);
    notificationApplicationService.notifyActiveTenantUsers(
        tenantId,
        approved
            ? PURCHASE_DEMAND_APPROVED_NOTIFICATION_TITLE
            : PURCHASE_DEMAND_REJECTED_NOTIFICATION_TITLE,
        "采购需求已审批" + (approved ? "通过" : "驳回") + "。");

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

  private String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value;
  }

  private void requireActiveDepartment(String tenantId, String departmentId) {
    if (!departmentMapper.existsActiveByTenantAndId(tenantId, departmentId)) {
      throw new IllegalArgumentException("Department not found in tenant scope: " + departmentId);
    }
  }
}
