package com.procurement.supplier.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.approval.application.ApprovalGate;
import com.procurement.approval.application.ApprovalTaskApplicationService;
import com.procurement.approval.domain.ApprovalBusinessType;
import com.procurement.approval.domain.ApprovalTask;
import com.procurement.approval.domain.ApprovalStatus;
import com.procurement.approval.infrastructure.ApprovalTaskMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.domain.AuditTargetType;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.common.api.ApprovalTaskResponse;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.notification.domain.NotificationTitle;
import com.procurement.supplier.api.ChangeBuyerSupplierPerformanceRequest;
import com.procurement.supplier.api.BuyerSupplierResponse;
import com.procurement.supplier.api.ChangeBuyerSupplierProfileRequest;
import com.procurement.supplier.api.ChangeBuyerSupplierStatusRequest;
import com.procurement.supplier.api.CreateBuyerSupplierRequest;
import com.procurement.supplier.api.ReviewBuyerSupplierAdmissionRequest;
import com.procurement.supplier.api.SupplierQualificationResponse;
import com.procurement.supplier.domain.BuyerSupplierAuditAction;
import com.procurement.supplier.domain.BuyerSupplierRelation;
import com.procurement.supplier.domain.BuyerSupplierAdmissionStatusTransition;
import com.procurement.supplier.domain.BuyerSupplierManualStatusTransition;
import com.procurement.supplier.domain.BuyerSupplierPerformanceScore;
import com.procurement.supplier.domain.BuyerSupplierRelationStatus;
import com.procurement.supplier.domain.SupplierQualification;
import com.procurement.supplier.infrastructure.BuyerSupplierRelationMapper;
import com.procurement.supplier.infrastructure.SupplierProfileMapper;
import com.procurement.supplier.infrastructure.SupplierQualificationMapper;
import com.procurement.workflow.application.UnifiedWorkflowApplicationService;
import com.procurement.workflow.application.WorkflowStartCommand;
import com.procurement.workflow.application.WorkflowStartResult;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BuyerSupplierApplicationService {
  private final BuyerSupplierRelationMapper buyerSupplierRelationMapper;
  private final SupplierProfileMapper supplierProfileMapper;
  private final SupplierQualificationMapper supplierQualificationMapper;
  private final ObjectMapper objectMapper;
  private final ApprovalTaskMapper approvalTaskMapper;
  private final ApprovalTaskApplicationService approvalTaskApplicationService;
  private final ApprovalGate approvalGate;
  private final AuditLogApplicationService auditLogApplicationService;
  private final NotificationApplicationService notificationApplicationService;
  private final BuyerSupplierAdmissionStatusTransition buyerSupplierAdmissionStatusTransition;
  private final BuyerSupplierManualStatusTransition buyerSupplierManualStatusTransition;
  private final SupplierQualificationApplicationService supplierQualificationApplicationService;
  private UnifiedWorkflowApplicationService unifiedWorkflowApplicationService;

  public BuyerSupplierApplicationService(
      BuyerSupplierRelationMapper buyerSupplierRelationMapper,
      SupplierQualificationMapper supplierQualificationMapper,
      ObjectMapper objectMapper,
      ApprovalTaskMapper approvalTaskMapper,
      ApprovalTaskApplicationService approvalTaskApplicationService,
      ApprovalGate approvalGate,
      AuditLogApplicationService auditLogApplicationService,
      NotificationApplicationService notificationApplicationService,
      BuyerSupplierAdmissionStatusTransition buyerSupplierAdmissionStatusTransition,
      BuyerSupplierManualStatusTransition buyerSupplierManualStatusTransition,
      SupplierProfileMapper supplierProfileMapper,
      SupplierQualificationApplicationService supplierQualificationApplicationService) {
    this.buyerSupplierRelationMapper = buyerSupplierRelationMapper;
    this.supplierQualificationMapper = supplierQualificationMapper;
    this.objectMapper = objectMapper;
    this.approvalTaskMapper = approvalTaskMapper;
    this.approvalTaskApplicationService = approvalTaskApplicationService;
    this.approvalGate = approvalGate;
    this.auditLogApplicationService = auditLogApplicationService;
    this.notificationApplicationService = notificationApplicationService;
    this.buyerSupplierAdmissionStatusTransition = buyerSupplierAdmissionStatusTransition;
    this.buyerSupplierManualStatusTransition = buyerSupplierManualStatusTransition;
    this.supplierQualificationApplicationService = supplierQualificationApplicationService;
    this.supplierProfileMapper = supplierProfileMapper;
  }

  @Autowired
  void setUnifiedWorkflowApplicationService(
      UnifiedWorkflowApplicationService unifiedWorkflowApplicationService) {
    this.unifiedWorkflowApplicationService = unifiedWorkflowApplicationService;
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

  /** 采购方核验下载:校验关系归属本租户后取证照原件(E-1)。 */
  public com.procurement.common.storage.ObjectStorageService.StoredObject loadRelationQualificationObject(
      String relationId, String qualificationId) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer supplier APIs");
    BuyerSupplierRelation relation = requireRelation(tenantId, relationId);
    com.procurement.supplier.domain.SupplierQualification qualification =
        supplierQualificationApplicationService.findForBuyerReview(relation.supplierId(), qualificationId);
    return supplierQualificationApplicationService.loadObject(qualification);
  }

  public List<SupplierQualificationResponse> listRelationQualifications(String relationId) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer supplier APIs");
    BuyerSupplierRelation relation = requireRelation(tenantId, relationId);
    return supplierQualificationMapper.listActiveBySupplier(relation.supplierId()).stream()
        .map(this::toQualificationResponse)
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
    applyMasterDataOnCreate(request);
    auditLogApplicationService.recordTenantAction(
        BuyerSupplierAuditAction.RELATION_CREATED,
        AuditTargetType.BUYER_SUPPLIER_RELATION,
        relationId);
    return toResponse(buyerSupplierRelationMapper.findByTenantAndId(tenantId, relationId));
  }

  // 采购方建档:登记时提供的主数据写入供应商主档(空值不覆盖既有值)。
  private void applyMasterDataOnCreate(CreateBuyerSupplierRequest request) {
    boolean hasAny = java.util.stream.Stream.of(
            request.creditCode(), request.legalPerson(), request.contactName(), request.contactPhone(),
            request.contactEmail(), request.businessScope(), request.bankName(), request.bankAccount())
        .anyMatch(v -> v != null && !v.isBlank());
    if (!hasAny || supplierProfileMapper == null) {
      return;
    }
    // 空值不覆盖既有值(SQL CASE 保留)。
    supplierProfileMapper.updateSupplierMasterData(
        request.supplierId(),
        request.creditCode(),
        request.legalPerson(),
        request.contactName(),
        request.contactPhone(),
        request.contactEmail(),
        request.businessScope(),
        request.bankName(),
        request.bankAccount());
  }

  @Transactional
  public ApprovalTaskResponse submitAdmission(String relationId) {
    return submitAdmission(relationId, Map.of());
  }

  @Transactional
  public ApprovalTaskResponse submitAdmission(String relationId, Map<String, Object> formData) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer supplier APIs");
    BuyerSupplierRelation relation = requireRelation(tenantId, relationId);
    buyerSupplierAdmissionStatusTransition.requireAdmissionSubmission(relation.status(), relationId);
    requireActiveQualification(relation);

    if (unifiedWorkflowApplicationService != null) {
      int updated = buyerSupplierRelationMapper.updateStatus(
          tenantId,
          relationId,
          BuyerSupplierRelationStatus.PENDING_ADMISSION,
          BuyerSupplierRelationStatus.IN_ADMISSION_APPROVAL);
      if (updated == 0) {
        throw new IllegalStateException("Supplier relation status changed before admission could be submitted: " + relationId);
      }
      WorkflowStartResult started = unifiedWorkflowApplicationService.start(new WorkflowStartCommand(
          ApprovalBusinessType.BUYER_SUPPLIER_ADMISSION,
          relationId,
          null,
          null,
          formData == null ? Map.of() : formData,
          Map.of("supplierId", relation.supplierId(), "supplierName", relation.supplierName())));
      auditLogApplicationService.recordTenantAction(
          BuyerSupplierAuditAction.ADMISSION_SUBMITTED,
          AuditTargetType.BUYER_SUPPLIER_RELATION,
          relationId);
      return new ApprovalTaskResponse(
          started.firstTaskId(),
          tenantId,
          ApprovalBusinessType.BUYER_SUPPLIER_ADMISSION,
          relationId,
          null,
          "审批中",
          started.createdAt());
    }

    // 审批闸门:准入审批节点关闭时免审直通(直接已准入,审计留痕)。
    if (!approvalGate.requiresApproval(tenantId, ApprovalBusinessType.BUYER_SUPPLIER_ADMISSION)) {
      int bypassed = buyerSupplierRelationMapper.updateStatus(
          tenantId,
          relationId,
          BuyerSupplierRelationStatus.PENDING_ADMISSION,
          BuyerSupplierRelationStatus.ADMITTED);
      if (bypassed == 0) {
        throw new IllegalStateException("Supplier relation status changed before admission could be submitted: " + relationId);
      }
      auditLogApplicationService.recordTenantAction(
          tenantId,
          BuyerSupplierAuditAction.ADMISSION_SUBMITTED,
          AuditTargetType.BUYER_SUPPLIER_RELATION,
          relationId,
          ApprovalGate.bypassDetail());
      return new ApprovalTaskResponse(
          null, tenantId, ApprovalBusinessType.BUYER_SUPPLIER_ADMISSION, relationId, null, "免审批", null);
    }

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

  private void requireActiveQualification(BuyerSupplierRelation relation) {
    if (supplierQualificationMapper.listActiveBySupplier(relation.supplierId()).isEmpty()) {
      throw new IllegalStateException(
          "Supplier admission requires at least one active qualification: " + relation.id());
    }
  }

  @Transactional
  public ApprovalTaskResponse reviewAdmission(String relationId, ReviewBuyerSupplierAdmissionRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer supplier APIs");
    String userId = TenantAccessGuard.requireUserId("buyer supplier APIs");
    BuyerSupplierRelation relation = requireRelation(tenantId, relationId);
    buyerSupplierAdmissionStatusTransition.requireAdmissionReview(relation.status(), relationId);

    if (unifiedWorkflowApplicationService != null) {
      var history = unifiedWorkflowApplicationService.completeCurrentUserBusinessTask(
          ApprovalBusinessType.BUYER_SUPPLIER_ADMISSION,
          relationId,
          Boolean.TRUE.equals(request.approved()),
          request.comment());
      String status = "approved".equals(history.status())
          ? ApprovalStatus.APPROVED
          : "rejected".equals(history.status()) ? ApprovalStatus.REJECTED : "审批中";
      return new ApprovalTaskResponse(
          null,
          tenantId,
          ApprovalBusinessType.BUYER_SUPPLIER_ADMISSION,
          relationId,
          userId,
          status,
          request.comment(),
          history.actedAt());
    }

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
        userId,
        request.comment());
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
        relation.performanceScore(),
        relation.cooperationTier(),
        relation.lastEvaluationScore(),
        relation.creditCode(),
        relation.legalPerson(),
        relation.contactName(),
        relation.contactPhone(),
        relation.contactEmail(),
        relation.businessScope(),
        relation.bankName(),
        relation.bankAccount());
  }

  private SupplierQualificationResponse toQualificationResponse(SupplierQualification qualification) {
    java.time.LocalDate today = java.time.LocalDate.now();
    return new SupplierQualificationResponse(
        qualification.id(),
        qualification.supplierId(),
        qualification.qualificationType(),
        qualification.certificateNo(),
        qualification.expiresAt(),
        qualification.fileName(),
        qualification.storageKey(),
        qualification.status(),
        qualification.createdAt(),
        com.procurement.supplier.domain.QualificationExpiryPolicy.expiryState(qualification.expiresAt(), today),
        com.procurement.supplier.domain.QualificationExpiryPolicy.daysToExpiry(qualification.expiresAt(), today));
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
        approvalTask.reviewComment(),
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
