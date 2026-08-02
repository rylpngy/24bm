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

  public SupplierQualificationApplicationService(
      SupplierQualificationMapper supplierQualificationMapper,
      SupplierQualificationStatusTransition supplierQualificationStatusTransition,
      ObjectStorageService objectStorageService) {
    this.supplierQualificationMapper = supplierQualificationMapper;
    this.supplierQualificationStatusTransition = supplierQualificationStatusTransition;
    this.objectStorageService = objectStorageService;
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
    return new QualificationUploadTicketResponse(
        request.fileName(), storageKey, uploadUrl, issuedAt, issuedAt.plusMinutes(15));
  }

  /** 服务端代收上传字节:仅允许写入本供应商命名空间下的对象键。 */
  public void storeObject(String storageKey, byte[] data, String contentType) {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier qualification APIs");
    requireOwnKey(storageKey, supplierId);
    objectStorageService.put(storageKey, data, contentType);
  }

  /** 供应商下载本方证照原件。 */
  public ObjectStorageService.StoredObject loadOwnObject(String qualificationId) {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier qualification APIs");
    SupplierQualification qualification = supplierQualificationMapper.findBySupplierAndId(supplierId, qualificationId);
    if (qualification == null) {
      throw new IllegalArgumentException("Supplier qualification not found in supplier scope: " + qualificationId);
    }
    return objectStorageService.get(qualification.storageKey());
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
    return objectStorageService.get(qualification.storageKey());
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
    QualificationExpiryPolicy.requireUploadedFile(request.fileName(), request.storageKey());
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
    return toResponse(supplierQualificationMapper.findBySupplierAndId(supplierId, qualificationId));
  }

  @Transactional
  public SupplierQualificationResponse changeQualificationStatus(
      String qualificationId,
      ChangeSupplierQualificationStatusRequest request) {
    String supplierId = TenantAccessGuard.requireSupplierId("supplier qualification APIs");
    supplierQualificationStatusTransition.requireSupportedTarget(request.status());
    requireQualification(supplierId, qualificationId);
    supplierQualificationMapper.updateStatus(supplierId, qualificationId, request.status());
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
