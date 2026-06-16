package com.procurement.attachment.application;

import com.procurement.attachment.api.AttachmentResponse;
import com.procurement.attachment.api.CreateAttachmentRequest;
import com.procurement.attachment.domain.Attachment;
import com.procurement.attachment.domain.AttachmentStatus;
import com.procurement.attachment.domain.AttachmentVisibility;
import com.procurement.attachment.infrastructure.AttachmentMapper;
import com.procurement.audit.infrastructure.AuditLogMapper;
import com.procurement.common.tenant.TenantAccessGuard;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AttachmentApplicationService {
  private final AttachmentMapper attachmentMapper;
  private final AuditLogMapper auditLogMapper;

  public AttachmentApplicationService(AttachmentMapper attachmentMapper, AuditLogMapper auditLogMapper) {
    this.attachmentMapper = attachmentMapper;
    this.auditLogMapper = auditLogMapper;
  }

  public List<AttachmentResponse> listCurrentTenantAttachments(String ownerType, String ownerId) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer attachment APIs");
    return attachmentMapper.listActiveByTenantAndOwner(tenantId, ownerType, ownerId).stream()
        .map(this::toResponse)
        .toList();
  }

  @Transactional
  public AttachmentResponse createCurrentTenantAttachment(CreateAttachmentRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer attachment APIs");
    String userId = TenantAccessGuard.requireUserId("buyer attachment APIs");
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
        request.ownerId());
    return toResponse(attachmentMapper.findByTenantAndId(tenantId, attachmentId));
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

}
