package com.procurement.attachment.application;

import com.procurement.attachment.api.AttachmentDownloadLinkResponse;
import com.procurement.attachment.api.AttachmentResponse;
import com.procurement.attachment.api.AttachmentUploadTicketResponse;
import com.procurement.attachment.api.CreateAttachmentRequest;
import com.procurement.attachment.api.CreateAttachmentUploadTicketRequest;
import com.procurement.attachment.domain.Attachment;
import com.procurement.attachment.domain.AttachmentStatus;
import com.procurement.attachment.domain.AttachmentVisibility;
import com.procurement.attachment.infrastructure.AttachmentMapper;
import com.procurement.audit.infrastructure.AuditLogMapper;
import com.procurement.common.storage.ObjectStorageService;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.sourcing.infrastructure.QuoteMapper;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AttachmentApplicationService {
  private final AttachmentMapper attachmentMapper;
  private final AuditLogMapper auditLogMapper;
  private final QuoteMapper quoteMapper;
  private final ObjectStorageService objectStorageService;

  public AttachmentApplicationService(
      AttachmentMapper attachmentMapper,
      AuditLogMapper auditLogMapper,
      QuoteMapper quoteMapper,
      ObjectStorageService objectStorageService) {
    this.attachmentMapper = attachmentMapper;
    this.auditLogMapper = auditLogMapper;
    this.quoteMapper = quoteMapper;
    this.objectStorageService = objectStorageService;
  }

  public List<AttachmentResponse> listCurrentTenantAttachments(String ownerType, String ownerId) {
    return listCurrentTenantAttachmentEntities(ownerType, ownerId).stream()
        .map(this::toResponse)
        .toList();
  }

  public List<Attachment> listCurrentTenantAttachmentEntities(String ownerType, String ownerId) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer attachment APIs");
    return attachmentMapper.listActiveByTenantAndOwner(tenantId, ownerType, ownerId);
  }

  public AttachmentUploadTicketResponse createCurrentTenantUploadTicket(CreateAttachmentUploadTicketRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer attachment APIs");
    validateOwnerInTenantScope(tenantId, request.ownerType(), request.ownerId());
    String visibility = AttachmentVisibility.normalize(request.visibility());
    OffsetDateTime createdAt = OffsetDateTime.now();
    String storageKey = "%s/%s/%s/%s-%s".formatted(
        tenantId,
        safePathSegment(request.ownerType()),
        safePathSegment(request.ownerId()),
        UUID.randomUUID(),
        safePathSegment(request.fileName()));
    String uploadUrl = "/api/v1/buyer/attachments/upload-sink?storageKey=%s&token=%s".formatted(
        encode(storageKey),
        UUID.randomUUID());
    return new AttachmentUploadTicketResponse(
        request.ownerType(),
        request.ownerId(),
        request.fileName(),
        storageKey,
        visibility,
        uploadUrl,
        createdAt,
        createdAt.plusMinutes(15));
  }

  public AttachmentDownloadLinkResponse createCurrentTenantDownloadLink(String attachmentId) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer attachment APIs");
    Attachment attachment = attachmentMapper.findByTenantAndId(tenantId, attachmentId);
    if (attachment == null || !AttachmentStatus.ACTIVE.equals(attachment.status())) {
      throw new IllegalArgumentException("Attachment not found in tenant scope: " + attachmentId);
    }
    OffsetDateTime createdAt = OffsetDateTime.now();
    String downloadUrl = "/api/v1/buyer/attachments/%s/download?token=%s&storageKey=%s".formatted(
        attachment.id(),
        UUID.randomUUID(),
        encode(attachment.storageKey()));
    return new AttachmentDownloadLinkResponse(
        attachment.id(),
        attachment.fileName(),
        attachment.storageKey(),
        downloadUrl,
        createdAt,
        createdAt.plusMinutes(15));
  }

  @Transactional
  public AttachmentResponse createCurrentTenantAttachment(CreateAttachmentRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer attachment APIs");
    String userId = TenantAccessGuard.requireUserId("buyer attachment APIs");
    validateOwnerInTenantScope(tenantId, request.ownerType(), request.ownerId());
    String attachmentId = "att-" + UUID.randomUUID();
    String visibility = AttachmentVisibility.normalize(request.visibility());
    attachmentMapper.insert(
        attachmentId,
        tenantId,
        request.ownerType(),
        request.ownerId(),
        request.fileName(),
        request.storageKey(),
        userId,
        visibility,
        AttachmentStatus.ACTIVE);
    auditLogMapper.insert(
        "audit-" + UUID.randomUUID(),
        tenantId,
        userId,
        "attachment.created",
        request.ownerType(),
        request.ownerId(),
        null);
    return toResponse(attachmentMapper.findByTenantAndId(tenantId, attachmentId));
  }

  // 服务端代收上传字节并落到对象存储(浏览器只与 :8080 通信,规避跨域)。
  public void storeCurrentTenantObject(String storageKey, byte[] data, String contentType) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer attachment APIs");
    if (storageKey == null || !storageKey.startsWith(tenantId + "/")) {
      throw new IllegalArgumentException("Storage key out of tenant scope: " + storageKey);
    }
    objectStorageService.put(storageKey, data, contentType);
  }

  // 按附件 id(租户内)取回字节,供下载端点流式返回。
  public DownloadedObject loadCurrentTenantObject(String attachmentId) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer attachment APIs");
    Attachment attachment = attachmentMapper.findByTenantAndId(tenantId, attachmentId);
    if (attachment == null || !AttachmentStatus.ACTIVE.equals(attachment.status())) {
      throw new IllegalArgumentException("Attachment not found in tenant scope: " + attachmentId);
    }
    ObjectStorageService.StoredObject stored = objectStorageService.get(attachment.storageKey());
    return new DownloadedObject(attachment.fileName(), stored.data(), stored.contentType());
  }

  public record DownloadedObject(String fileName, byte[] data, String contentType) {
  }

  private AttachmentResponse toResponse(Attachment attachment) {
    return new AttachmentResponse(
        attachment.id(),
        attachment.tenantId(),
        attachment.ownerType(),
        attachment.ownerId(),
        attachment.fileName(),
        attachment.storageKey(),
        attachment.uploadedBy(),
        attachment.visibility(),
        attachment.status(),
        attachment.createdAt());
  }

  private String safePathSegment(String value) {
    return value == null || value.isBlank()
        ? "attachment"
        : value.trim().replaceAll("[\\\\/]+", "-");
  }

  private String encode(String value) {
    return URLEncoder.encode(value, StandardCharsets.UTF_8);
  }

  private void validateOwnerInTenantScope(String tenantId, String ownerType, String ownerId) {
    if (!"quote".equals(ownerType)) {
      return;
    }
    if (quoteMapper.findByTenantAndId(tenantId, ownerId) == null) {
      throw new IllegalArgumentException("Quote attachment owner not found in tenant scope: " + ownerId);
    }
  }

}
