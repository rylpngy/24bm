package com.procurement.demand.application;

import com.procurement.approval.domain.ApprovalTask;
import com.procurement.approval.application.ApprovalGate;
import com.procurement.approval.application.ApprovalTaskApplicationService;
import com.procurement.approval.domain.ApprovalBusinessType;
import com.procurement.approval.domain.ApprovalStatus;
import com.procurement.approval.infrastructure.ApprovalTaskMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.api.ApprovalTaskResponse;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.demand.api.CreatePurchaseDemandRequest;
import com.procurement.demand.api.PurchaseDemandLineItemResponse;
import com.procurement.demand.api.PurchaseDemandResponse;
import com.procurement.demand.api.PurchaseDemandPageResponse;
import com.procurement.demand.api.ReviewPurchaseDemandRequest;
import com.procurement.demand.api.UpdatePurchaseDemandRequest;
import com.procurement.demand.domain.PurchaseDemand;
import com.procurement.demand.domain.PurchaseDemandAuditAction;
import com.procurement.demand.domain.PurchaseDemandSource;
import com.procurement.demand.domain.PurchaseDemandApprovalStatusTransition;
import com.procurement.demand.domain.PurchaseDemandItem;
import com.procurement.demand.domain.PurchaseDemandStatus;
import com.procurement.demand.infrastructure.PurchaseDemandItemMapper;
import com.procurement.demand.infrastructure.PurchaseDemandMapper;
import com.procurement.identity.application.DataScopeService;
import com.procurement.identity.application.PermissionService;
import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.identity.domain.DataScope;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.notification.domain.NotificationTitle;
import com.procurement.organization.infrastructure.DepartmentMapper;
import com.procurement.numbering.application.NumberingApplicationService;
import com.procurement.sourcing.application.RfqDemandLinkQueryService;
import com.procurement.workflow.application.UnifiedWorkflowApplicationService;
import com.procurement.workflow.application.WorkflowStartCommand;
import com.procurement.workflow.application.WorkflowStartResult;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PurchaseDemandApplicationService {
  private final PurchaseDemandMapper purchaseDemandMapper;
  private final PurchaseDemandItemMapper purchaseDemandItemMapper;
  private final ApprovalTaskMapper approvalTaskMapper;
  private final ApprovalTaskApplicationService approvalTaskApplicationService;
  private final ApprovalGate approvalGate;
  private final RfqDemandLinkQueryService rfqDemandLinkQueryService;
  private final DepartmentMapper departmentMapper;
  private final AuditLogApplicationService auditLogApplicationService;
  private final NotificationApplicationService notificationApplicationService;
  private final PurchaseDemandApprovalStatusTransition purchaseDemandApprovalStatusTransition;
  private final DataScopeService dataScopeService;
  private final PermissionService permissionService;
  private UnifiedWorkflowApplicationService unifiedWorkflowApplicationService;
  private NumberingApplicationService numbering;

  public PurchaseDemandApplicationService(
      PurchaseDemandMapper purchaseDemandMapper,
      PurchaseDemandItemMapper purchaseDemandItemMapper,
      ApprovalTaskMapper approvalTaskMapper,
      ApprovalTaskApplicationService approvalTaskApplicationService,
      ApprovalGate approvalGate,
      RfqDemandLinkQueryService rfqDemandLinkQueryService,
      DepartmentMapper departmentMapper,
      AuditLogApplicationService auditLogApplicationService,
      NotificationApplicationService notificationApplicationService,
      PurchaseDemandApprovalStatusTransition purchaseDemandApprovalStatusTransition,
      DataScopeService dataScopeService,
      PermissionService permissionService) {
    this.purchaseDemandMapper = purchaseDemandMapper;
    this.purchaseDemandItemMapper = purchaseDemandItemMapper;
    this.approvalTaskMapper = approvalTaskMapper;
    this.approvalTaskApplicationService = approvalTaskApplicationService;
    this.approvalGate = approvalGate;
    this.rfqDemandLinkQueryService = rfqDemandLinkQueryService;
    this.departmentMapper = departmentMapper;
    this.auditLogApplicationService = auditLogApplicationService;
    this.notificationApplicationService = notificationApplicationService;
    this.purchaseDemandApprovalStatusTransition = purchaseDemandApprovalStatusTransition;
    this.dataScopeService = dataScopeService;
    this.permissionService = permissionService;
  }

  @Autowired
  void setNumberingApplicationService(NumberingApplicationService numbering) {
    this.numbering = numbering;
  }

  @Autowired
  void setUnifiedWorkflowApplicationService(
      UnifiedWorkflowApplicationService unifiedWorkflowApplicationService) {
    this.unifiedWorkflowApplicationService = unifiedWorkflowApplicationService;
  }

  public List<PurchaseDemandResponse> listCurrentTenantDemands() {
    return listCurrentTenantDemands(null, null, null);
  }

  @Transactional(readOnly = true, isolation = org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
  public PurchaseDemandPageResponse pageCurrentTenantDemands(
      int page, int pageSize, String status, String departmentId, String keyword) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer demand APIs");
    permissionService.require("buyer:demand:read");
    if (page < 1 || pageSize < 1 || pageSize > 100) {
      throw new IllegalArgumentException("page must be positive and pageSize must be between 1 and 100");
    }
    DataScope scope = dataScopeService.currentUserDataScope();
    List<String> departments = scope.restricted() && scope.requesterId() == null ? scope.departmentIds() : null;
    String department = blankToNull(departmentId);
    if (scope.blocksAll() || (departments != null && department != null && !departments.contains(department))) {
      return new PurchaseDemandPageResponse(List.of(), 0, page, pageSize);
    }
    String requester = scope.restricted() ? scope.requesterId() : null;
    long total = purchaseDemandMapper.countPage(tenantId, blankToNull(status), department,
        blankToNull(keyword), departments, requester);
    List<PurchaseDemandResponse> items = toResponses(purchaseDemandMapper.listPage(tenantId,
        blankToNull(status), department, blankToNull(keyword), departments, requester,
        pageSize, (long) (page - 1) * pageSize));
    return new PurchaseDemandPageResponse(items, total, page, pageSize);
  }

  public PurchaseDemandResponse getCurrentTenantDemand(String id) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer demand APIs");
    permissionService.require("buyer:demand:read");
    PurchaseDemand demand = purchaseDemandMapper.findByTenantAndId(tenantId, id);
    if (demand == null) throw new IllegalArgumentException("Purchase demand not found in tenant scope");
    requireDataScope(demand.departmentId(), demand.requesterId());
    return toResponse(demand);
  }

  public List<PurchaseDemandResponse> listCurrentTenantDemands(
      String status,
      String departmentId,
      String keyword) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer demand APIs");
    permissionService.require("buyer:demand:read");
    // 行级权限:按有效数据范围收窄——部门集合(本部门 / 本部门及下级)IN,或仅本人(requester_id)。
    DataScope dataScope = dataScopeService.currentUserDataScope();
    if (dataScope.blocksAll()) {
      return List.of();
    }
    String uiDepartmentId = blankToNull(departmentId);
    List<String> scopeDepartmentIds = dataScope.restricted() && dataScope.requesterId() == null
        ? dataScope.departmentIds()
        : null;
    // 数据范围限定部门集合时,UI 部门筛选只能在范围内收窄。
    if (scopeDepartmentIds != null && uiDepartmentId != null
        && !scopeDepartmentIds.contains(uiDepartmentId)) {
      return List.of();
    }
    String requesterId = dataScope.restricted() ? dataScope.requesterId() : null;
    return toResponses(purchaseDemandMapper.listByTenantFiltered(
            tenantId,
            blankToNull(status),
            uiDepartmentId,
            blankToNull(keyword),
            scopeDepartmentIds,
            requesterId));
  }

  @Transactional
  public PurchaseDemandResponse create(CreatePurchaseDemandRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer demand APIs");
    String userId = TenantAccessGuard.requireUserId("buyer demand APIs");
    permissionService.require("buyer:demand:create");
    requireActiveDepartment(tenantId, request.departmentId());
    requireDataScope(request.departmentId(), userId);
    String demandId = nextDemandId(request.departmentId());

    purchaseDemandMapper.insert(
        demandId,
        tenantId,
        request.title(),
        request.departmentId(),
        userId,
        request.budget(),
        PurchaseDemandStatus.DRAFT,
        request.expectedDeliveryDate(),
        request.priority() == null ? "常规" : request.priority(),
        request.purpose() == null ? "" : request.purpose(),
        PurchaseDemandSource.DEPARTMENT);

    for (var lineItem : request.lineItems()) {
      purchaseDemandItemMapper.insert(
          newId("dem-item"),
          tenantId,
          demandId,
          lineItem.materialId(),
          lineItem.quantity());
    }
    auditLogApplicationService.recordTenantAction(
        PurchaseDemandAuditAction.CREATED,
        ApprovalBusinessType.PURCHASE_DEMAND,
        demandId);

    return toResponse(purchaseDemandMapper.findByTenantAndId(tenantId, demandId));
  }

  @Transactional
  public PurchaseDemandResponse update(String demandId, UpdatePurchaseDemandRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer demand APIs");
    permissionService.require("buyer:demand:create");
    PurchaseDemand demand = purchaseDemandMapper.findByTenantAndIdForUpdate(tenantId, demandId);
    if (demand == null) {
      throw new IllegalArgumentException("Purchase demand not found: " + demandId);
    }
    requireDataScope(demand.departmentId(), demand.requesterId());
    requireDataScope(request.departmentId(), demand.requesterId());
    if (!PurchaseDemandStatus.DRAFT.equals(demand.status()) && !PurchaseDemandStatus.REJECTED.equals(demand.status())) {
      throw new IllegalStateException("Only draft purchase demand can be updated: " + demandId);
    }
    requireActiveDepartment(tenantId, request.departmentId());

    int updated = purchaseDemandMapper.updateDraft(
        tenantId,
        demandId,
        request.title(),
        request.departmentId(),
        request.budget(),
        request.expectedDeliveryDate(),
        request.priority() == null ? "常规" : request.priority(),
        request.purpose() == null ? "" : request.purpose());
    if (updated == 0) {
      throw new IllegalStateException("Purchase demand status changed before update could be saved: " + demandId);
    }

    purchaseDemandItemMapper.deleteByDemand(tenantId, demandId);
    for (var lineItem : request.lineItems()) {
      purchaseDemandItemMapper.insert(
          newId("dem-item"),
          tenantId,
          demandId,
          lineItem.materialId(),
          lineItem.quantity());
    }
    auditLogApplicationService.recordTenantAction(
        PurchaseDemandAuditAction.UPDATED,
        ApprovalBusinessType.PURCHASE_DEMAND,
        demandId);

    return toResponse(purchaseDemandMapper.findByTenantAndId(tenantId, demandId));
  }

  @Transactional
  public ApprovalTaskResponse submit(String demandId) {
    return submit(demandId, Map.of());
  }

  @Transactional
  public ApprovalTaskResponse submit(String demandId, Map<String, Object> formData) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer demand APIs");
    permissionService.require("buyer:demand:create");
    // Serialize profile edits before reading approval amount/department and building its immutable snapshot.
    // This path starts a new workflow only; it never locks an existing workflow instance in reverse callback order.
    PurchaseDemand demand = purchaseDemandMapper.findByTenantAndIdForUpdate(tenantId, demandId);
    if (demand == null) {
      throw new IllegalArgumentException("Purchase demand not found: " + demandId);
    }
    requireDataScope(demand.departmentId(), demand.requesterId());
    purchaseDemandApprovalStatusTransition.requireSubmission(demand.status(), demandId);

    // 旧离线构造的兼容路径；Spring 生产装配始终注入 Flowable 统一门面。
    if (unifiedWorkflowApplicationService == null) {
      return submitLegacy(demandId, tenantId, demand);
    }

    if (purchaseDemandMapper.updateStatusIfCurrent(tenantId, demandId, demand.status(), PurchaseDemandStatus.IN_APPROVAL) == 0) {
      throw new IllegalStateException("Purchase demand changed before submission: " + demandId);
    }
    Map<String, Object> snapshot = new LinkedHashMap<>();
    snapshot.put("title", demand.title());
    snapshot.put("budget", demand.budget());
    snapshot.put("priority", demand.priority());
    snapshot.put("purpose", demand.purpose());
    snapshot.put("expectedDeliveryDate", demand.expectedDeliveryDate() == null ? null : demand.expectedDeliveryDate().toString());
    WorkflowStartResult started = unifiedWorkflowApplicationService.start(new WorkflowStartCommand(
        ApprovalBusinessType.PURCHASE_DEMAND,
        demandId,
        demand.departmentId(),
        demand.budget(),
        formData == null ? Map.of() : formData,
        snapshot));
    auditLogApplicationService.recordTenantAction(
        PurchaseDemandAuditAction.SUBMITTED,
        ApprovalBusinessType.PURCHASE_DEMAND,
        demandId);
    notificationApplicationService.notifyActiveTenantUsers(
        tenantId,
        NotificationTitle.PURCHASE_DEMAND_PENDING_APPROVAL,
        demand.title() + "已提交审批，请及时处理。");
    return new ApprovalTaskResponse(
        started.firstTaskId(),
        tenantId,
        ApprovalBusinessType.PURCHASE_DEMAND,
        demandId,
        null,
        "审批中",
        started.createdAt());
  }

  private ApprovalTaskResponse submitLegacy(String demandId, String tenantId, PurchaseDemand demand) {
    // 审批闸门:需求审批节点关闭时免审直通(状态直达已通过,审计留痕)。
    if (!approvalGate.requiresApproval(tenantId, ApprovalBusinessType.PURCHASE_DEMAND)) {
      purchaseDemandMapper.updateStatus(tenantId, demandId, PurchaseDemandStatus.APPROVED);
      auditLogApplicationService.recordTenantAction(
          tenantId,
          PurchaseDemandAuditAction.SUBMITTED,
          ApprovalBusinessType.PURCHASE_DEMAND,
          demandId,
          ApprovalGate.bypassDetail());
      notificationApplicationService.notifyActiveTenantUsers(
          tenantId,
          NotificationTitle.PURCHASE_DEMAND_PENDING_APPROVAL,
          demand.title() + "已提交,审批节点已关闭,自动通过。");
      return new ApprovalTaskResponse(
          null, tenantId, ApprovalBusinessType.PURCHASE_DEMAND, demandId, null, "免审批", null);
    }

    purchaseDemandMapper.updateStatus(tenantId, demandId, PurchaseDemandStatus.IN_APPROVAL);

    ApprovalTask approvalTask = approvalTaskApplicationService.createPendingTask(
        tenantId,
        ApprovalBusinessType.PURCHASE_DEMAND,
        demandId,
        null);
    auditLogApplicationService.recordTenantAction(
        PurchaseDemandAuditAction.SUBMITTED,
        ApprovalBusinessType.PURCHASE_DEMAND,
        demandId);
    notificationApplicationService.notifyActiveTenantUsers(
        tenantId,
        NotificationTitle.PURCHASE_DEMAND_PENDING_APPROVAL,
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
    requireDataScope(demand.departmentId(), demand.requesterId());
    purchaseDemandApprovalStatusTransition.requireReview(demand.status(), demandId);

    if (unifiedWorkflowApplicationService != null) {
      var history = unifiedWorkflowApplicationService.completeCurrentUserBusinessTask(
          ApprovalBusinessType.PURCHASE_DEMAND,
          demandId,
          Boolean.TRUE.equals(request.approved()),
          request.comment());
      String status = "approved".equals(history.status())
          ? ApprovalStatus.APPROVED
          : "rejected".equals(history.status()) ? ApprovalStatus.REJECTED : "审批中";
      return new ApprovalTaskResponse(
          null,
          tenantId,
          ApprovalBusinessType.PURCHASE_DEMAND,
          demandId,
          userId,
          status,
          request.comment(),
          history.actedAt());
    }

    ApprovalTask approvalTask = approvalTaskMapper.findPendingByBiz(
        tenantId,
        ApprovalBusinessType.PURCHASE_DEMAND,
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
        userId,
        request.comment());
    if (updated == 0) {
      throw new IllegalStateException("Approval task status changed before review could be recorded: " + approvalTask.id());
    }
    int demandUpdated = purchaseDemandMapper.updateStatus(tenantId, demandId, demandStatus);
    if (demandUpdated == 0) {
      throw new IllegalStateException("Purchase demand status changed before review could be saved: " + demandId);
    }
    auditLogApplicationService.recordTenantAction(
        approved ? PurchaseDemandAuditAction.APPROVED : PurchaseDemandAuditAction.REJECTED,
        ApprovalBusinessType.PURCHASE_DEMAND,
        demandId);
    notificationApplicationService.notifyActiveTenantUsers(
        tenantId,
        approved
            ? NotificationTitle.PURCHASE_DEMAND_APPROVED
            : NotificationTitle.PURCHASE_DEMAND_REJECTED,
        "采购需求已审批" + (approved ? "通过" : "驳回") + "。");

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

  // 跨模块查询入口:按指定租户与需求批量取物资明细(供询比装配采购清单)。
  public List<com.procurement.demand.domain.PurchaseDemandItem> findItemsByTenantAndDemands(
      String tenantId, java.util.List<String> demandIds) {
    if (demandIds == null || demandIds.isEmpty()) {
      return List.of();
    }
    return demandIds.stream()
        .flatMap(demandId -> purchaseDemandItemMapper.listByDemand(tenantId, demandId).stream())
        .toList();
  }

  private PurchaseDemandResponse toResponse(PurchaseDemand demand) {
    List<PurchaseDemandLineItemResponse> lineItems = purchaseDemandItemMapper
        .listByDemand(demand.tenantId(), demand.id())
        .stream()
        .map(this::toLineItemResponse)
        .toList();
    RfqDemandLinkQueryService.RfqDemandLink linkedRfq =
        rfqDemandLinkQueryService.findLatestLinkForDemand(demand.tenantId(), demand.id());

    return toResponse(demand, lineItems, linkedRfq);
  }

  private List<PurchaseDemandResponse> toResponses(List<PurchaseDemand> demands) {
    var responses = new ArrayList<PurchaseDemandResponse>(demands.size());
    // Bound SQL parameters for legacy full-list callers while avoiding per-row queries.
    for (int start = 0; start < demands.size(); start += 500) {
      var batch = demands.subList(start, Math.min(start + 500, demands.size()));
      String tenantId = batch.getFirst().tenantId();
      var ids = batch.stream().map(PurchaseDemand::id).toList();
      var items = purchaseDemandItemMapper.listByDemands(tenantId, ids).stream()
          .collect(Collectors.groupingBy(PurchaseDemandItem::demandId));
      var links = rfqDemandLinkQueryService.findLatestLinksForDemands(tenantId, ids);
      for (var demand : batch) {
        responses.add(toResponse(demand, items.getOrDefault(demand.id(), List.of()).stream()
            .map(this::toLineItemResponse).toList(), links.get(demand.id())));
      }
    }
    return responses;
  }

  private PurchaseDemandResponse toResponse(PurchaseDemand demand,
      List<PurchaseDemandLineItemResponse> lineItems, RfqDemandLinkQueryService.RfqDemandLink linkedRfq) {

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
        lineItems,
        demand.expectedDeliveryDate(),
        demand.priority(),
        demand.purpose(),
        linkedRfq == null ? null : linkedRfq.rfqId(),
        linkedRfq == null ? null : linkedRfq.status(),
        demand.source());
  }

  private PurchaseDemandLineItemResponse toLineItemResponse(PurchaseDemandItem item) {
    return new PurchaseDemandLineItemResponse(item.id(), item.materialId(), item.quantity());
  }

  private String nextDemandId(String departmentId) {
    return numbering == null
        ? NumberingApplicationService.defaultNumber("demand", departmentId, purchaseDemandMapper::allocateSequence)
        : numbering.nextDemandNumber(departmentId, purchaseDemandMapper::allocateSequence);
  }

  private void requireDataScope(String departmentId, String requesterId) {
    DataScope scope = dataScopeService.currentUserDataScope();
    if (scope == null || scope.blocksAll()
        || (scope.restricted() && (scope.requesterId() != null
            ? !scope.requesterId().equals(requesterId)
            : !scope.departmentIds().contains(departmentId)))) {
      throw new PermissionDeniedException("当前数据范围无权操作该采购需求");
    }
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
