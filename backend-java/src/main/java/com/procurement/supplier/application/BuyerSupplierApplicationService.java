package com.procurement.supplier.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.approval.application.ApprovalTaskApplicationService;
import com.procurement.approval.domain.ApprovalTask;
import com.procurement.approval.infrastructure.ApprovalTaskMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.demand.api.ApprovalTaskResponse;
import com.procurement.supplier.api.ChangeBuyerSupplierPerformanceRequest;
import com.procurement.supplier.api.BuyerSupplierResponse;
import com.procurement.supplier.api.ChangeBuyerSupplierProfileRequest;
import com.procurement.supplier.api.ChangeBuyerSupplierStatusRequest;
import com.procurement.supplier.api.CreateBuyerSupplierRequest;
import com.procurement.supplier.api.ReviewBuyerSupplierAdmissionRequest;
import com.procurement.supplier.domain.BuyerSupplierRelation;
import com.procurement.supplier.infrastructure.BuyerSupplierRelationMapper;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BuyerSupplierApplicationService {
  private static final String PENDING_ADMISSION_STATUS = "待准入";
  private static final String IN_ADMISSION_APPROVAL_STATUS = "准入审批中";
  private static final String ADMITTED_STATUS = "已准入";
  private static final String REJECTED_STATUS = "已驳回";
  private static final String BLACKLISTED_STATUS = "黑名单";
  private static final String APPROVED_STATUS = "已通过";
  private static final String BUYER_SUPPLIER_ADMISSION_BIZ_TYPE = "buyer_supplier_admission";
  private static final String BUYER_SUPPLIER_RELATION_TARGET_TYPE = "buyer_supplier_relation";
  private static final String SUPPLIER_RELATION_CREATED_ACTION = "buyer_supplier_relation.created";
  private static final String SUPPLIER_ADMISSION_SUBMITTED_ACTION = "buyer_supplier_admission.submitted";
  private static final String SUPPLIER_ADMISSION_APPROVED_ACTION = "buyer_supplier_admission.approved";
  private static final String SUPPLIER_ADMISSION_REJECTED_ACTION = "buyer_supplier_admission.rejected";
  private static final String SUPPLIER_RELATION_PROFILE_UPDATED_ACTION = "buyer_supplier_relation.profile_updated";
  private static final String SUPPLIER_RELATION_PERFORMANCE_UPDATED_ACTION = "buyer_supplier_relation.performance_updated";
  private static final String SUPPLIER_RELATION_STATUS_CHANGED_ACTION = "buyer_supplier_relation.status_changed";

  private final BuyerSupplierRelationMapper buyerSupplierRelationMapper;
  private final ObjectMapper objectMapper;
  private final ApprovalTaskMapper approvalTaskMapper;
  private final ApprovalTaskApplicationService approvalTaskApplicationService;
  private final AuditLogApplicationService auditLogApplicationService;

  public BuyerSupplierApplicationService(
      BuyerSupplierRelationMapper buyerSupplierRelationMapper,
      ObjectMapper objectMapper,
      ApprovalTaskMapper approvalTaskMapper,
      ApprovalTaskApplicationService approvalTaskApplicationService,
      AuditLogApplicationService auditLogApplicationService) {
    this.buyerSupplierRelationMapper = buyerSupplierRelationMapper;
    this.objectMapper = objectMapper;
    this.approvalTaskMapper = approvalTaskMapper;
    this.approvalTaskApplicationService = approvalTaskApplicationService;
    this.auditLogApplicationService = auditLogApplicationService;
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
        SUPPLIER_RELATION_CREATED_ACTION,
        BUYER_SUPPLIER_RELATION_TARGET_TYPE,
        relationId);
    return toResponse(buyerSupplierRelationMapper.findByTenantAndId(tenantId, relationId));
  }

  @Transactional
  public ApprovalTaskResponse submitAdmission(String relationId) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer supplier APIs");
    BuyerSupplierRelation relation = requireRelation(tenantId, relationId);
    if (!PENDING_ADMISSION_STATUS.equals(relation.status())) {
      throw new IllegalStateException("Only pending supplier relations can be submitted for admission: " + relationId);
    }

    int updated = buyerSupplierRelationMapper.updateStatus(
        tenantId,
        relationId,
        PENDING_ADMISSION_STATUS,
        IN_ADMISSION_APPROVAL_STATUS);
    if (updated == 0) {
      throw new IllegalStateException("Supplier relation status changed before admission could be submitted: " + relationId);
    }

    ApprovalTask approvalTask = approvalTaskApplicationService.createPendingTask(
        tenantId,
        BUYER_SUPPLIER_ADMISSION_BIZ_TYPE,
        relationId,
        null);
    auditLogApplicationService.recordTenantAction(
        SUPPLIER_ADMISSION_SUBMITTED_ACTION,
        BUYER_SUPPLIER_RELATION_TARGET_TYPE,
        relationId);

    return toApprovalTaskResponse(approvalTask);
  }

  @Transactional
  public ApprovalTaskResponse reviewAdmission(String relationId, ReviewBuyerSupplierAdmissionRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer supplier APIs");
    String userId = TenantAccessGuard.requireUserId("buyer supplier APIs");
    BuyerSupplierRelation relation = requireRelation(tenantId, relationId);
    if (!IN_ADMISSION_APPROVAL_STATUS.equals(relation.status())) {
      throw new IllegalStateException("Only supplier relations in admission approval can be reviewed: " + relationId);
    }

    ApprovalTask approvalTask = approvalTaskMapper.findPendingByBiz(
        tenantId,
        BUYER_SUPPLIER_ADMISSION_BIZ_TYPE,
        relationId,
        ApprovalTaskApplicationService.PENDING_APPROVAL_STATUS);
    if (approvalTask == null) {
      throw new IllegalStateException("Pending approval task not found for supplier admission: " + relationId);
    }

    String approvalStatus = Boolean.TRUE.equals(request.approved()) ? APPROVED_STATUS : REJECTED_STATUS;
    String relationStatus = Boolean.TRUE.equals(request.approved()) ? ADMITTED_STATUS : REJECTED_STATUS;
    int approvalUpdated = approvalTaskMapper.updateStatus(
        tenantId,
        approvalTask.id(),
        ApprovalTaskApplicationService.PENDING_APPROVAL_STATUS,
        approvalStatus,
        userId);
    if (approvalUpdated == 0) {
      throw new IllegalStateException("Approval task status changed before review could be recorded: " + approvalTask.id());
    }

    int relationUpdated = buyerSupplierRelationMapper.updateStatus(
        tenantId,
        relationId,
        IN_ADMISSION_APPROVAL_STATUS,
        relationStatus);
    if (relationUpdated == 0) {
      throw new IllegalStateException("Supplier relation status changed before admission review could be applied: " + relationId);
    }
    auditLogApplicationService.recordTenantAction(
        Boolean.TRUE.equals(request.approved()) ? SUPPLIER_ADMISSION_APPROVED_ACTION : SUPPLIER_ADMISSION_REJECTED_ACTION,
        BUYER_SUPPLIER_RELATION_TARGET_TYPE,
        relationId);

    return toApprovalTaskResponse(approvalTaskMapper.findByTenantAndId(tenantId, approvalTask.id()));
  }

  @Transactional
  public BuyerSupplierResponse changeRelationStatus(String relationId, ChangeBuyerSupplierStatusRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer supplier APIs");
    BuyerSupplierRelation relation = requireRelation(tenantId, relationId);
    requireSupportedManualTargetStatus(request.status());
    requireManualStatusTransition(relation.status(), request.status(), relationId);

    int updated = buyerSupplierRelationMapper.updateStatus(
        tenantId,
        relationId,
        relation.status(),
        request.status());
    if (updated == 0) {
      throw new IllegalStateException("Supplier relation status changed before manual update could be applied: " + relationId);
    }
    auditLogApplicationService.recordTenantAction(
        SUPPLIER_RELATION_STATUS_CHANGED_ACTION,
        BUYER_SUPPLIER_RELATION_TARGET_TYPE,
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
        SUPPLIER_RELATION_PROFILE_UPDATED_ACTION,
        BUYER_SUPPLIER_RELATION_TARGET_TYPE,
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
        SUPPLIER_RELATION_PERFORMANCE_UPDATED_ACTION,
        BUYER_SUPPLIER_RELATION_TARGET_TYPE,
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

  private void requireSupportedManualTargetStatus(String status) {
    if (!BLACKLISTED_STATUS.equals(status) && !PENDING_ADMISSION_STATUS.equals(status)) {
      throw new IllegalArgumentException("Unsupported buyer supplier relation target status: " + status);
    }
  }

  private void requireManualStatusTransition(String currentStatus, String targetStatus, String relationId) {
    if (IN_ADMISSION_APPROVAL_STATUS.equals(currentStatus)) {
      throw new IllegalStateException("Supplier relations in admission approval cannot be manually changed: " + relationId);
    }
    if (PENDING_ADMISSION_STATUS.equals(targetStatus)
        && !BLACKLISTED_STATUS.equals(currentStatus)
        && !REJECTED_STATUS.equals(currentStatus)) {
      throw new IllegalStateException("Only blacklisted or rejected supplier relations can be restored to pending admission: " + relationId);
    }
  }

  private void requirePerformanceScore(BigDecimal performanceScore) {
    if (performanceScore == null
        || performanceScore.compareTo(BigDecimal.ZERO) < 0
        || performanceScore.compareTo(BigDecimal.valueOf(100)) > 0) {
      throw new IllegalArgumentException("Supplier performance score must be between 0 and 100.");
    }
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
