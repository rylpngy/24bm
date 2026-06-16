package com.procurement.supplier.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.approval.application.ApprovalTaskApplicationService;
import com.procurement.approval.domain.ApprovalBusinessType;
import com.procurement.approval.domain.ApprovalTask;
import com.procurement.approval.domain.ApprovalStatus;
import com.procurement.approval.infrastructure.ApprovalTaskMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.domain.AuditTargetType;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.demand.api.ApprovalTaskResponse;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.notification.domain.NotificationTitle;
import com.procurement.supplier.api.ChangeBuyerSupplierPerformanceRequest;
import com.procurement.supplier.api.BuyerSupplierResponse;
import com.procurement.supplier.api.ChangeBuyerSupplierProfileRequest;
import com.procurement.supplier.api.ChangeBuyerSupplierStatusRequest;
import com.procurement.supplier.api.CreateBuyerSupplierRequest;
import com.procurement.supplier.api.ReviewBuyerSupplierAdmissionRequest;
import com.procurement.supplier.domain.BuyerSupplierAuditAction;
import com.procurement.supplier.domain.BuyerSupplierRelation;
import com.procurement.supplier.domain.BuyerSupplierAdmissionStatusTransition;
import com.procurement.supplier.domain.BuyerSupplierManualStatusTransition;
import com.procurement.supplier.domain.BuyerSupplierPerformanceScore;
import com.procurement.supplier.domain.BuyerSupplierRelationStatus;
import com.procurement.supplier.infrastructure.BuyerSupplierRelationMapper;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BuyerSupplierApplicationService {
  private final BuyerSupplierRelationMapper buyerSupplierRelationMapper;
  private final ObjectMapper objectMapper;
  private final ApprovalTaskMapper approvalTaskMapper;
  private final ApprovalTaskApplicationService approvalTaskApplicationService;
  private final AuditLogApplicationService auditLogApplicationService;
  private final NotificationApplicationService notificationApplicationService;
  private final BuyerSupplierAdmissionStatusTransition buyerSupplierAdmissionStatusTransition;
  private final BuyerSupplierManualStatusTransition buyerSupplierManualStatusTransition;

  public BuyerSupplierApplicationService(
      BuyerSupplierRelationMapper buyerSupplierRelationMapper,
      ObjectMapper objectMapper,
      ApprovalTaskMapper approvalTaskMapper,
      ApprovalTaskApplicationService approvalTaskApplicationService,
      AuditLogApplicationService auditLogApplicationService,
      NotificationApplicationService notificationApplicationService,
      BuyerSupplierAdmissionStatusTransition buyerSupplierAdmissionStatusTransition,
      BuyerSupplierManualStatusTransition buyerSupplierManualStatusTransition) {
    this.buyerSupplierRelationMapper = buyerSupplierRelationMapper;
    this.objectMapper = objectMapper;
    this.approvalTaskMapper = approvalTaskMapper;
    this.approvalTaskApplicationService = approvalTaskApplicationService;
    this.auditLogApplicationService = auditLogApplicationService;
    this.notificationApplicationService = notificationApplicationService;
    this.buyerSupplierAdmissionStatusTransition = buyerSupplierAdmissionStatusTransition;
    this.buyerSupplierManualStatusTransition = buyerSupplierManualStatusTransition;
  }

  public List<BuyerSupplierResponse> listCurrentTenantSuppliers() {
    return listCurrentTenantSuppliers(null, null, null, null);
  }

  public List<BuyerSupplierResponse> listCurrentTenantSuppliers(
      String status,
      String level,
      String category,
      String keyword) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer supplier APIs");
    return buyerSupplierRelationMapper.listByTenant(
            tenantId,
            blankToNull(status),
            blankToNull(level),
            blankToNull(category),
            blankToNull(keyword))
        .stream()
        .map(this::toResponse)
        .toList();
  }

  @Transactional
  public BuyerSupplierResponse createSupplierRelation(CreateBuyerSupplierRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer supplier APIs");
    String relationId = "bsr-" + UUID.randomUUID();
    buyerSupplierRelationMapper.insert(
        relationId,
        tenantId,
        request.supplierId(),
        request.status(),
        request.level(),
        writeCategories(request.categories()));
    auditLogApplicationService.recordTenantAction(
        BuyerSupplierAuditAction.RELATION_CREATED,
        AuditTargetType.BUYER_SUPPLIER_RELATION,
        relationId);
    return toResponse(buyerSupplierRelationMapper.findByTenantAndId(tenantId, relationId));
  }

  @Transactional
  public ApprovalTaskResponse submitAdmission(String relationId) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer supplier APIs");
    BuyerSupplierRelation relation = requireRelation(tenantId, relationId);
    buyerSupplierAdmissionStatusTransition.requireAdmissionSubmission(relation.status(), relationId);

    int updated = buyerSupplierRelationMapper.updateStatus(
        tenantId,
        relationId,
        BuyerSupplierRelationStatus.PENDING_ADMISSION,
        BuyerSupplierRelationStatus.IN_ADMISSION_APPROVAL);
    if (updated == 0) {
      throw new IllegalStateException("Supplier relation status changed before admission could be submitted: " + relationId);
    }

    ApprovalTask approvalTask = approvalTaskApplicationService.createPendingTask(
        tenantId,
        ApprovalBusinessType.BUYER_SUPPLIER_ADMISSION,
        relationId,
        null);
    auditLogApplicationService.recordTenantAction(
        BuyerSupplierAuditAction.ADMISSION_SUBMITTED,
        AuditTargetType.BUYER_SUPPLIER_RELATION,
        relationId);

    return toApprovalTaskResponse(approvalTask);
  }

  @Transactional
  public ApprovalTaskResponse reviewAdmission(String relationId, ReviewBuyerSupplierAdmissionRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer supplier APIs");
    String userId = TenantAccessGuard.requireUserId("buyer supplier APIs");
    BuyerSupplierRelation relation = requireRelation(tenantId, relationId);
    buyerSupplierAdmissionStatusTransition.requireAdmissionReview(relation.status(), relationId);

    ApprovalTask approvalTask = approvalTaskMapper.findPendingByBiz(
        tenantId,
        ApprovalBusinessType.BUYER_SUPPLIER_ADMISSION,
        relationId,
        ApprovalStatus.PENDING);
    if (approvalTask == null) {
      throw new IllegalStateException("Pending approval task not found for supplier admission: " + relationId);
    }

    String approvalStatus = Boolean.TRUE.equals(request.approved()) ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED;
    boolean approved = Boolean.TRUE.equals(request.approved());
    String relationStatus = buyerSupplierAdmissionStatusTransition.reviewTargetStatus(approved);
    int approvalUpdated = approvalTaskMapper.updateStatus(
        tenantId,
        approvalTask.id(),
        ApprovalStatus.PENDING,
        approvalStatus,
        userId);
    if (approvalUpdated == 0) {
      throw new IllegalStateException("Approval task status changed before review could be recorded: " + approvalTask.id());
    }

    int relationUpdated = buyerSupplierRelationMapper.updateStatus(
        tenantId,
        relationId,
        BuyerSupplierRelationStatus.IN_ADMISSION_APPROVAL,
        relationStatus);
    if (relationUpdated == 0) {
      throw new IllegalStateException("Supplier relation status changed before admission review could be applied: " + relationId);
    }
    auditLogApplicationService.recordTenantAction(
        approved ? BuyerSupplierAuditAction.ADMISSION_APPROVED : BuyerSupplierAuditAction.ADMISSION_REJECTED,
        AuditTargetType.BUYER_SUPPLIER_RELATION,
        relationId);
    notificationApplicationService.notifyActiveTenantUsers(
        tenantId,
        approved
            ? NotificationTitle.SUPPLIER_ADMISSION_APPROVED
            : NotificationTitle.SUPPLIER_ADMISSION_REJECTED,
        relation.supplierName() + "准入审批已" + (approved ? "通过" : "驳回") + "。");

    return toApprovalTaskResponse(approvalTaskMapper.findByTenantAndId(tenantId, approvalTask.id()));
  }

  @Transactional
  public BuyerSupplierResponse changeRelationStatus(String relationId, ChangeBuyerSupplierStatusRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer supplier APIs");
    BuyerSupplierRelation relation = requireRelation(tenantId, relationId);
    buyerSupplierManualStatusTransition.requireSupportedTarget(request.status());
    buyerSupplierManualStatusTransition.requireTransition(relation.status(), request.status(), relationId);

    int updated = buyerSupplierRelationMapper.updateStatus(
        tenantId,
        relationId,
        relation.status(),
        request.status());
    if (updated == 0) {
      throw new IllegalStateException("Supplier relation status changed before manual update could be applied: " + relationId);
    }
    auditLogApplicationService.recordTenantAction(
        BuyerSupplierAuditAction.RELATION_STATUS_CHANGED,
        AuditTargetType.BUYER_SUPPLIER_RELATION,
        relationId);

    return toResponse(buyerSupplierRelationMapper.findByTenantAndId(tenantId, relationId));
  }

  @Transactional
  public BuyerSupplierResponse changeRelationProfile(String relationId, ChangeBuyerSupplierProfileRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer supplier APIs");
    requireRelation(tenantId, relationId);
    buyerSupplierRelationMapper.updateProfile(
        tenantId,
        relationId,
        request.level(),
        writeCategories(request.categories()));
    auditLogApplicationService.recordTenantAction(
        BuyerSupplierAuditAction.RELATION_PROFILE_UPDATED,
        AuditTargetType.BUYER_SUPPLIER_RELATION,
        relationId);

    return toResponse(buyerSupplierRelationMapper.findByTenantAndId(tenantId, relationId));
  }

  @Transactional
  public BuyerSupplierResponse changeRelationPerformance(
      String relationId,
      ChangeBuyerSupplierPerformanceRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer supplier APIs");
    requirePerformanceScore(request.performanceScore());
    requireRelation(tenantId, relationId);
    buyerSupplierRelationMapper.updatePerformanceScore(
        tenantId,
        relationId,
        request.performanceScore());
    auditLogApplicationService.recordTenantAction(
        BuyerSupplierAuditAction.RELATION_PERFORMANCE_UPDATED,
        AuditTargetType.BUYER_SUPPLIER_RELATION,
        relationId);

    return toResponse(buyerSupplierRelationMapper.findByTenantAndId(tenantId, relationId));
  }

  private BuyerSupplierResponse toResponse(BuyerSupplierRelation relation) {
    return new BuyerSupplierResponse(
        relation.id(),
        relation.tenantId(),
        relation.supplierId(),
        relation.supplierName(),
        relation.status(),
        relation.level(),
        readCategories(relation.categoriesJson()),
        relation.performanceScore());
  }

  private BuyerSupplierRelation requireRelation(String tenantId, String relationId) {
    BuyerSupplierRelation relation = buyerSupplierRelationMapper.findByTenantAndId(tenantId, relationId);
    if (relation == null) {
      throw new IllegalArgumentException("Buyer supplier relation not found: " + relationId);
    }
    return relation;
  }

  private ApprovalTaskResponse toApprovalTaskResponse(ApprovalTask approvalTask) {
    return new ApprovalTaskResponse(
        approvalTask.id(),
        approvalTask.tenantId(),
        approvalTask.bizType(),
        approvalTask.bizId(),
        approvalTask.assigneeId(),
        approvalTask.status(),
        approvalTask.createdAt());
  }

  private void requirePerformanceScore(BigDecimal performanceScore) {
    BuyerSupplierPerformanceScore.requireValid(performanceScore);
  }

  private List<String> readCategories(String categoriesJson) {
    try {
      return objectMapper.readValue(categoriesJson == null ? "[]" : categoriesJson, new TypeReference<>() {});
    } catch (JsonProcessingException exception) {
      throw new IllegalStateException("Invalid supplier category JSON.", exception);
    }
  }

  private String writeCategories(List<String> categories) {
    try {
      return objectMapper.writeValueAsString(categories == null ? List.of() : categories);
    } catch (JsonProcessingException exception) {
      throw new IllegalStateException("Unable to serialize supplier categories.", exception);
    }
  }

  private String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value;
  }
}
