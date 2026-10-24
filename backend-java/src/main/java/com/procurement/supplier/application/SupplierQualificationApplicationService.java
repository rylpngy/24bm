package com.procurement.supplier.application;

import com.procurement.common.storage.ObjectStorageService;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.supplier.api.ChangeSupplierQualificationStatusRequest;
import com.procurement.supplier.api.CreateSupplierQualificationRequest;
import com.procurement.supplier.api.CreateQualificationUploadTicketRequest;
import com.procurement.supplier.api.QualificationUploadTicketResponse;
import com.procurement.supplier.api.SupplierQualificationResponse;
import com.procurement.supplier.domain.SupplierQualification;
import com.procurement.supplier.domain.SupplierQualificationStatus;
import com.procurement.supplier.domain.QualificationExpiryPolicy;
import com.procurement.supplier.domain.SupplierQualificationStatusTransition;
import com.procurement.supplier.infrastructure.SupplierQualificationMapper;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SupplierQualificationApplicationService {
  private final SupplierQualificationMapper supplierQualificationMapper;
  private final SupplierQualificationStatusTransition supplierQualificationStatusTransition;
  private final ObjectStorageService objectStorageService;
  private final QualificationNotificationService notifications;

  public SupplierQualificationApplicationService(
      SupplierQualificationMapper supplierQualificationMapper,
      SupplierQualificationStatusTransition supplierQualificationStatusTransition,
      ObjectStorageService objectStorageService,
      QualificationNotificationService notifications) {
    this.supplierQualificationMapper = supplierQualificationMapper;
    this.supplierQualificationStatusTransition = supplierQualificationStatusTransition;
    this.objectStorageService = objectStorageService;
    this.notifications = notifications;
  }

  // ── E-1 证照自助上传 ─────────────────────────────────────
  /** 上传票据:按 supplier 维度生成对象键与直传地址(15 分钟有效)。 */
  public QualificationUploadTicketResponse createUploadTicket(CreateQualificationUploadTicketRequest request) {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier qualification APIs");
    OffsetDateTime issuedAt = OffsetDateTime.now();
    String storageKey = "supplier-qualifications/%s/%s-%s".formatted(
        safeSegment(supplierId), UUID.randomUUID(), safeSegment(request.fileName()));
    String uploadUrl = "/api/v1/supplier/qualifications/upload-sink?storageKey="
        + URLEncoder.encode(storageKey, StandardCharsets.UTF_8);
    supplierQualificationMapper.issueUpload(storageKey, supplierId, request.fileName());
    return new QualificationUploadTicketResponse(
        request.fileName(), storageKey, uploadUrl, issuedAt, issuedAt.plusMinutes(15));
  }

  /** 服务端代收上传字节:仅允许写入本供应商命名空间下的对象键。 */
  public void storeObject(String storageKey, byte[] data, String contentType) {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier qualification APIs");
    requireOwnKey(storageKey, supplierId);
    if (data == null || data.length == 0 || data.length > 20 * 1024 * 1024) {
      throw new IllegalArgumentException("证照文件不能为空且不能超过 20 MB");
    }
    if (supplierQualificationMapper.claimUpload(storageKey, supplierId) != 1) {
      throw new IllegalArgumentException("上传凭证已失效或已使用，请重新选择文件");
    }
    objectStorageService.put(storageKey, data, contentType);
    supplierQualificationMapper.finishUpload(storageKey, supplierId, hash(data), data.length);
  }

  /** 供应商下载本方证照原件。 */
  public ObjectStorageService.StoredObject loadOwnObject(String qualificationId) {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier qualification APIs");
    SupplierQualification qualification = supplierQualificationMapper.findBySupplierAndId(supplierId, qualificationId);
    if (qualification == null) {
      throw new IllegalArgumentException("Supplier qualification not found in supplier scope: " + qualificationId);
    }
    return loadObject(qualification);
  }

  /** 采购方核验入口:按供应商 id 读取其证照原件(准入审核用)。 */
  public SupplierQualification findForBuyerReview(String supplierId, String qualificationId) {
    SupplierQualification qualification = supplierQualificationMapper.findBySupplierAndId(supplierId, qualificationId);
    if (qualification == null) {
      throw new IllegalArgumentException("Supplier qualification not found: " + qualificationId);
    }
    return qualification;
  }

  public ObjectStorageService.StoredObject loadObject(SupplierQualification qualification) {
    var object = objectStorageService.get(qualification.storageKey());
    String expected = supplierQualificationMapper.originalHash(qualification.storageKey());
    if (expected != null && !expected.equals(hash(object.data()))) {
      throw new IllegalStateException("原件完整性核验失败，请联系管理员，禁止使用该文件进行审核");
    }
    return object;
  }

  private static String hash(byte[] data) {
    try {
      return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(data));
    } catch (java.security.NoSuchAlgorithmException exception) {
      throw new IllegalStateException(exception);
    }
  }

  public String ownFileName(String id) {
    return findForBuyerReview(TenantAccessGuard.requireSupplierId("supplier qualification APIs"), id).fileName();
  }

  public List<java.util.Map<String, Object>> history() {
    return supplierQualificationMapper.history(TenantAccessGuard.requireSupplierId("supplier qualification APIs"));
  }

  @Transactional
  public SupplierQualificationResponse replaceQualification(String id, CreateSupplierQualificationRequest request) {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier qualification APIs");
    supplierQualificationMapper.lockSupplier(supplierId);
    if (supplierQualificationMapper.lockQualification(supplierId, id) == null
        || supplierQualificationMapper.replacement(supplierId, id) != null) {
      throw new IllegalArgumentException("资质不存在或已被新版替代，请刷新列表");
    }
    var replacement = createCurrentSupplierQualification(request);
    if (supplierQualificationMapper.replace(supplierId, id, replacement.id()) != 1) {
      throw new IllegalStateException("资质已发生变更，请刷新列表");
    }
    supplierQualificationMapper.recordEvent(supplierId, id, replacement.id(), "replaced",
        TenantAccessGuard.requireUserId("supplier qualification APIs"));
    supplierQualificationMapper.supersedeReviews(id);
    supplierQualificationMapper.returnSupersededSupplements(id);
    supplierQualificationMapper.enqueueReviews(supplierId, replacement.id(), id);
    notifications.reviewCreated(supplierId, replacement.id());
    return replacement;
  }

  public List<com.procurement.supplier.api.QualificationReviewResponse> buyerReviews() {
    return supplierQualificationMapper.reviews(TenantAccessGuard.requireTenantId("qualification review"), null);
  }

  public List<com.procurement.supplier.api.QualificationReviewResponse> supplierReviews() {
    return supplierQualificationMapper.reviews(null, TenantAccessGuard.requireSupplierId("qualification review"));
  }

  @Transactional
  public void review(long id, com.procurement.supplier.api.QualificationReviewRequest request) {
    throw new IllegalStateException("资质变更已迁入统一审批，请先发起变更审批并由当前节点办理人处理");
  }

  // Only the registered Flowable completion handler calls this after verifying its bound attempt.
  @Transactional
  public void applyWorkflowReview(long id, com.procurement.supplier.api.QualificationReviewRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("qualification review");
    String supplierId = supplierQualificationMapper.reviewSupplier(tenantId, id);
    String qualificationId = supplierQualificationMapper.reviewQualification(tenantId, id);
    if (supplierId == null || qualificationId == null) throw new IllegalArgumentException("复核记录不存在或不属于当前企业");
    var qualification = supplierQualificationMapper.lockQualification(supplierId, qualificationId);
    if (qualification == null || supplierQualificationMapper.replacement(supplierId, qualificationId) != null
        || !SupplierQualificationStatus.ACTIVE.equals(qualification.status())) {
      throw new IllegalArgumentException("资质已变更或停用，请刷新后核验最新版");
    }
    if (request.comment() == null || request.comment().isBlank() || request.comment().length() > 2000) {
      throw new IllegalArgumentException("请填写不超过2000字的复核意见");
    }
    if (Boolean.TRUE.equals(request.approved())) {
      if (qualification.expiresAt() != null && qualification.expiresAt().isBefore(LocalDate.now())) {
        throw new IllegalArgumentException("已过期资质不能通过复核");
      }
      loadObject(qualification);
    }
    String actor = TenantAccessGuard.requireUserId("qualification review");
    if (supplierQualificationMapper.decideReview(tenantId, id, Boolean.TRUE.equals(request.approved()) ? "approved" : "rejected", request.comment().trim(), actor) != 1) {
      throw new IllegalStateException("该复核已办理或资质已更新，请刷新");
    }
    notifications.reviewCompleted(tenantId, id);
  }

  private static void requireOwnKey(String storageKey, String supplierId) {
    String prefix = "supplier-qualifications/" + safeSegment(supplierId) + "/";
    if (storageKey == null || !storageKey.startsWith(prefix)) {
      throw new IllegalArgumentException("上传对象键不属于本供应商命名空间");
    }
  }

  private static String safeSegment(String value) {
    return value == null ? "unknown" : value.replaceAll("[^A-Za-z0-9._-]", "_");
  }

  public List<SupplierQualificationResponse> listCurrentSupplierQualifications() {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier qualification APIs");
    return supplierQualificationMapper.listActiveBySupplier(supplierId).stream()
        .map(this::toResponse)
        .toList();
  }

  public List<SupplierQualificationResponse> listCurrentSupplierQualifications(String status, String keyword) {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier qualification APIs");
    String normalizedStatus = blankToNull(status);
    return supplierQualificationMapper.listBySupplierFiltered(
            supplierId,
            normalizedStatus == null ? SupplierQualificationStatus.ACTIVE : normalizedStatus,
            blankToNull(keyword))
        .stream()
        .map(this::toResponse)
        .toList();
  }

  @Transactional
  public SupplierQualificationResponse createCurrentSupplierQualification(CreateSupplierQualificationRequest request) {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier qualification APIs");
    supplierQualificationMapper.lockSupplier(supplierId);
    QualificationExpiryPolicy.requireUploadedFile(request.fileName(), request.storageKey());
    requireOwnKey(request.storageKey(), supplierId);
    ObjectStorageService.StoredObject original = objectStorageService.get(request.storageKey());
    if (original == null || original.data() == null || original.data().length == 0) {
      throw new IllegalArgumentException("请先上传有效的证照原件再归档");
    }
    String expected = supplierQualificationMapper.originalHash(request.storageKey());
    if (expected == null || !expected.equals(hash(original.data()))
        || supplierQualificationMapper.registerUpload(request.storageKey(), supplierId, request.fileName()) != 1) {
      throw new IllegalArgumentException("原件未上传、已归档或完整性核验失败，请重新上传");
    }
    String qualificationId = "qual-" + UUID.randomUUID();
    supplierQualificationMapper.insert(
        qualificationId,
        supplierId,
        request.qualificationType(),
        request.certificateNo(),
        request.expiresAt(),
        request.fileName(),
        request.storageKey(),
        SupplierQualificationStatus.ACTIVE);
    supplierQualificationMapper.recordEvent(supplierId, qualificationId, null, "created",
        TenantAccessGuard.requireUserId("supplier qualification APIs"));
    return toResponse(supplierQualificationMapper.findBySupplierAndId(supplierId, qualificationId));
  }

  @Transactional
  public SupplierQualificationResponse changeQualificationStatus(
      String qualificationId,
      ChangeSupplierQualificationStatusRequest request) {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier qualification APIs");
    supplierQualificationMapper.lockSupplier(supplierId);
    supplierQualificationStatusTransition.requireSupportedTarget(request.status());
    requireQualification(supplierId, qualificationId);
    supplierQualificationMapper.lockQualification(supplierId, qualificationId);
    if (supplierQualificationMapper.replacement(supplierId, qualificationId) != null) {
      throw new IllegalArgumentException("此资质已被新版替代，不允许重新启用或修改");
    }
    supplierQualificationMapper.updateStatus(supplierId, qualificationId, request.status());
    supplierQualificationMapper.recordEvent(supplierId, qualificationId, null, request.status(),
        TenantAccessGuard.requireUserId("supplier qualification APIs"));
    return toResponse(supplierQualificationMapper.findBySupplierAndId(supplierId, qualificationId));
  }

  private String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value;
  }

  private void requireQualification(String supplierId, String qualificationId) {
    if (supplierQualificationMapper.findBySupplierAndId(supplierId, qualificationId) == null) {
      throw new IllegalArgumentException("Supplier qualification not found in supplier scope: " + qualificationId);
    }
  }

  private SupplierQualificationResponse toResponse(SupplierQualification qualification) {
    LocalDate today = LocalDate.now();
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
        QualificationExpiryPolicy.expiryState(qualification.expiresAt(), today),
        QualificationExpiryPolicy.daysToExpiry(qualification.expiresAt(), today));
  }
}
