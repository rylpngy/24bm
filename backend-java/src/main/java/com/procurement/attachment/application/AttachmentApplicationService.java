package com.procurement.attachment.application;

import com.procurement.attachment.api.AttachmentDownloadLinkResponse;
import com.procurement.attachment.api.AttachmentIntegrityResponse;
import com.procurement.attachment.api.AttachmentResponse;
import com.procurement.attachment.api.AttachmentUploadTicketResponse;
import com.procurement.attachment.api.CreateAttachmentRequest;
import com.procurement.attachment.api.CreateAttachmentUploadTicketRequest;
import com.procurement.attachment.domain.Attachment;
import com.procurement.attachment.domain.AttachmentStatus;
import com.procurement.attachment.domain.AttachmentVisibility;
import com.procurement.attachment.infrastructure.AttachmentMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.attachment.domain.AttachmentUploadTicket;
import com.procurement.attachment.infrastructure.AttachmentUploadTicketMapper;
import com.procurement.common.storage.ObjectStorageService;
import com.procurement.common.storage.StoredObjectMissingException;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.common.tenant.PermissionDeniedException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AttachmentApplicationService {
  private final AttachmentMapper attachmentMapper;
  private final AuditLogApplicationService auditService;
  private final AttachmentAccessService access;
  private final AttachmentUploadTicketMapper tickets;
  private final ObjectStorageService objectStorageService;

  public AttachmentApplicationService(
      AttachmentMapper attachmentMapper,
      AuditLogApplicationService auditService,
      AttachmentAccessService access,
      ObjectStorageService objectStorageService,
      AttachmentUploadTicketMapper tickets) {
    this.attachmentMapper = attachmentMapper;
    this.auditService = auditService;
    this.access = access;
    this.tickets = tickets;
    this.objectStorageService = objectStorageService;
  }

  public List<AttachmentResponse> listCurrentTenantAttachments(String ownerType, String ownerId) {
    return listCurrentTenantAttachmentEntities(ownerType, ownerId).stream()
        .map(this::toResponse)
        .toList();
  }

  /** Metadata only: a null baseline means no upload-time integrity evidence, not a verified empty file. */
  public List<ProcurementExecutionAttachmentMetadata> procurementExecutionAttachmentMetadata(String ownerType, String ownerId) {
    String tenantId = TenantAccessGuard.requireTenantId("procurement execution attachment metadata");
    return listCurrentTenantAttachmentEntities(ownerType, ownerId).stream().map(attachment -> {
      var fingerprint = attachmentMapper.fingerprint(tenantId, attachment.id());
      return new ProcurementExecutionAttachmentMetadata(attachment.id(), attachment.tenantId(),
          attachment.ownerType(), attachment.ownerId(), attachment.fileName(),
          fingerprint == null ? null : fingerprint.contentSize(), fingerprint == null ? null : fingerprint.contentSha256());
    }).toList();
  }

  public record ProcurementExecutionAttachmentMetadata(String id, String tenantId, String ownerType,
      String ownerId, String fileName, Long contentSize, String contentSha256) {}

  public List<Attachment> listCurrentTenantAttachmentEntities(String ownerType, String ownerId) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer attachment APIs");
    access.requireAccess(ownerType, ownerId, false);
    return attachmentMapper.listActiveByTenantAndOwner(tenantId, ownerType, ownerId);
  }

  public AttachmentUploadTicketResponse createCurrentTenantUploadTicket(CreateAttachmentUploadTicketRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer attachment APIs");
    String userId = TenantAccessGuard.requireUserId("buyer attachment APIs");
    access.requireAccess(request.ownerType(), request.ownerId(), true);
    requireFileName(request.fileName());
    String visibility = AttachmentVisibility.normalize(request.visibility());
    OffsetDateTime createdAt = OffsetDateTime.now();
    String storageKey = "%s/%s/%s/%s-%s".formatted(
        tenantId,
        safePathSegment(request.ownerType()),
        safePathSegment(request.ownerId()),
        UUID.randomUUID(),
        safePathSegment(request.fileName()));
    requireTenantStorageKey(tenantId, storageKey);
    String token = UUID.randomUUID().toString();
    tickets.insert(new AttachmentUploadTicket(storageKey, tenantId, userId, request.ownerType(),
        request.ownerId(), request.fileName(), visibility, hashToken(token), "issued", createdAt, createdAt.plusMinutes(15)));
    String uploadUrl = "/api/v1/buyer/attachments/upload-sink?storageKey=%s&token=%s".formatted(
        encode(storageKey),
        token);
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
    requireAttachmentStorageKey(tenantId, attachment);
    access.requireAccess(attachment.ownerType(), attachment.ownerId(), false);
    OffsetDateTime createdAt = OffsetDateTime.now();
    // Downloads always require the current authenticated session and current business permissions.
    String downloadUrl = "/api/v1/buyer/attachments/%s/download".formatted(attachment.id());
    return new AttachmentDownloadLinkResponse(
        attachment.id(),
        attachment.fileName(),
        attachment.storageKey(),
        downloadUrl,
        createdAt,
        null);
  }

  @Transactional
  public AttachmentResponse createCurrentTenantAttachment(CreateAttachmentRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer attachment APIs");
    String userId = TenantAccessGuard.requireUserId("buyer attachment APIs");
    requireTenantStorageKey(tenantId, request.storageKey());
    access.requireAccess(request.ownerType(), request.ownerId(), true);
    requireFileName(request.fileName());
    String attachmentId = "att-" + UUID.randomUUID();
    String visibility = AttachmentVisibility.normalize(request.visibility());
    if (tickets.consume(tenantId, request.storageKey(), userId, request.ownerType(), request.ownerId(),
        request.fileName(), visibility) != 1) {
      throw new PermissionDeniedException("附件尚未上传、票据已过期或登记信息与上传不一致，请重新上传");
    }
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
    if (attachmentMapper.copyUploadFingerprint(tenantId, attachmentId) != 1) {
      throw new IllegalStateException("附件上传信息不一致，请重新上传");
    }
    auditService.recordTenantAction(
        "attachment.created",
        request.ownerType(),
        request.ownerId());
    return toResponse(attachmentMapper.findByTenantAndId(tenantId, attachmentId));
  }

  // 服务端代收上传字节并落到对象存储(浏览器只与 :8080 通信,规避跨域)。
  @Transactional(propagation = org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED)
  public void storeCurrentTenantObject(String storageKey, String token, byte[] data, String contentType) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer attachment APIs");
    String userId = TenantAccessGuard.requireUserId("buyer attachment APIs");
    requireTenantStorageKey(tenantId, storageKey);
    var ticket = tickets.find(tenantId, storageKey, userId);
    if (ticket == null || token == null || token.isBlank()) throw new PermissionDeniedException("无效的上传票据");
    access.requireAccess(ticket.ownerType(), ticket.ownerId(), true);
    if (tickets.claim(tenantId, storageKey, userId, hashToken(token)) != 1) {
      throw new PermissionDeniedException("上传票据无效、已过期或已使用，请重新选择文件上传");
    }
    // Claim commits before object I/O. Failures/crashes cannot make the same key writable again.
    try {
      objectStorageService.put(storageKey, data, contentType);
      if (tickets.finishUploaded(tenantId, storageKey, userId, data.length, sha256(data)) != 1) {
        throw new IllegalStateException("Unable to complete attachment upload");
      }
    } catch (RuntimeException error) {
      tickets.finish(tenantId, storageKey, userId, "failed");
      throw error;
    }
  }

  // 按附件 id(租户内)取回字节,供下载端点流式返回。
  public DownloadedObject loadCurrentTenantObject(String attachmentId) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer attachment APIs");
    Attachment attachment = attachmentMapper.findByTenantAndId(tenantId, attachmentId);
    if (attachment == null || !AttachmentStatus.ACTIVE.equals(attachment.status())) {
      throw new IllegalArgumentException("Attachment not found in tenant scope: " + attachmentId);
    }
    requireAttachmentStorageKey(tenantId, attachment);
    access.requireAccess(attachment.ownerType(), attachment.ownerId(), false);
    ObjectStorageService.StoredObject stored = objectStorageService.get(attachment.storageKey());
    var fingerprint = attachmentMapper.fingerprint(tenantId, attachmentId);
    if (hasFingerprint(fingerprint) && !matches(fingerprint, stored.data())) {
      throw new IllegalStateException("附件内容与上传时记录不一致，已阻止下载，请联系管理员核查备份");
    }
    return new DownloadedObject(attachment.fileName(), stored.data(), stored.contentType());
  }

  public AttachmentIntegrityResponse checkCurrentTenantIntegrity(String attachmentId) {
    String tenant = TenantAccessGuard.requireTenantId("buyer attachment APIs");
    var attachment = attachmentMapper.findByTenantAndId(tenant, attachmentId);
    if (attachment == null || !AttachmentStatus.ACTIVE.equals(attachment.status())) {
      throw new IllegalArgumentException("附件不存在或不属于当前企业");
    }
    access.requireAccess(attachment.ownerType(), attachment.ownerId(), false);
    var fingerprint = attachmentMapper.fingerprint(tenant, attachmentId);
    Long expected = fingerprint == null ? null : fingerprint.contentSize();
    try {
      requireAttachmentStorageKey(tenant, attachment);
    } catch (PermissionDeniedException error) {
      return new AttachmentIntegrityResponse(attachmentId, "invalid_path", "历史附件路径不符合企业及业务归属规则，禁止读取，需管理员核对", expected, null, OffsetDateTime.now());
    }
    try {
      var object = objectStorageService.get(attachment.storageKey());
      String status = !hasFingerprint(fingerprint) ? "unverified" : matches(fingerprint, object.data()) ? "verified" : "mismatch";
      String message = switch (status) {
        case "verified" -> "文件大小及SHA-256与上传时记录一致";
        case "mismatch" -> "文件内容与上传时记录不一致，已禁止下载，请核查备份";
        default -> "文件可读取，但缺少上传时校验基线，无法确认历史内容一致性";
      };
      return new AttachmentIntegrityResponse(attachmentId, status, message, expected, (long) object.data().length, OffsetDateTime.now());
    } catch (StoredObjectMissingException error) {
      return new AttachmentIntegrityResponse(attachmentId, "missing", error.getMessage(), expected, null, OffsetDateTime.now());
    } catch (IllegalStateException error) {
      return new AttachmentIntegrityResponse(attachmentId, "unavailable", "存储暂不可用，不能判定文件是否缺失，请稍后重试或联系管理员", expected, null, OffsetDateTime.now());
    }
  }

  private boolean hasFingerprint(AttachmentMapper.Fingerprint fingerprint) {
    return fingerprint != null && fingerprint.contentSize() != null && fingerprint.contentSha256() != null;
  }

  private boolean matches(AttachmentMapper.Fingerprint fingerprint, byte[] data) {
    return fingerprint.contentSize() == data.length && fingerprint.contentSha256().equals(sha256(data));
  }

  private String sha256(byte[] data) {
    try {
      return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(data));
    } catch (java.security.NoSuchAlgorithmException error) {
      throw new IllegalStateException(error);
    }
  }

  public record DownloadedObject(String fileName, byte[] data, String contentType) {
  }

  private void requireTenantStorageKey(String tenantId, String storageKey) {
    if (storageKey == null || !storageKey.startsWith(tenantId + "/")
        || storageKey.length() <= tenantId.length() + 1
        || storageKey.contains("\\") || storageKey.chars().anyMatch(Character::isISOControl)
        || Arrays.stream(storageKey.split("/", -1))
            .anyMatch(segment -> segment.isEmpty() || segment.equals(".") || segment.equals(".."))) {
      throw new PermissionDeniedException("附件存储路径不属于当前企业或路径无效");
    }
  }

  private void requireAttachmentStorageKey(String tenantId, Attachment attachment) {
    requireTenantStorageKey(tenantId, attachment.storageKey());
    String ownerPrefix = tenantId + "/" + safePathSegment(attachment.ownerType()) + "/"
        + safePathSegment(attachment.ownerId()) + "/";
    if (!attachment.storageKey().startsWith(ownerPrefix)) {
      throw new PermissionDeniedException("附件存储路径与业务归属不一致，请联系管理员核验历史附件");
    }
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

  private void requireFileName(String name) {
    if (name == null || name.isBlank() || name.length() > 255 || name.chars().anyMatch(Character::isISOControl)) {
      throw new IllegalArgumentException("附件名称不能为空、超过 255 字符或包含控制字符");
    }
  }

  private String hashToken(String token) {
    try {
      return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256")
          .digest(token.getBytes(StandardCharsets.UTF_8)));
    } catch (java.security.NoSuchAlgorithmException error) {
      throw new IllegalStateException(error);
    }
  }

}
