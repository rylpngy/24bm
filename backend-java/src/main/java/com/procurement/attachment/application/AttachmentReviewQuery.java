package com.procurement.attachment.application;

import com.procurement.attachment.domain.Attachment;
import com.procurement.attachment.infrastructure.AttachmentMapper;
import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.common.tenant.TenantAccessGuard;
import java.util.List;
import org.springframework.stereotype.Service;

/** Application boundary for review snapshots; callers authorize the owning business object. */
@Service
public class AttachmentReviewQuery {
  private final AttachmentMapper attachments;

  public AttachmentReviewQuery(AttachmentMapper attachments) {
    this.attachments = attachments;
  }

  public List<Attachment> listActiveByTenantAndOwner(String tenantId, String ownerType, String ownerId) {
    requireTenant(tenantId);
    return attachments.listActiveByTenantAndOwner(tenantId, ownerType, ownerId);
  }

  public String fingerprint(String tenantId, String attachmentId) {
    requireTenant(tenantId);
    // Preserve the existing serialized fingerprint, including null, to keep approved hashes valid.
    return String.valueOf(attachments.fingerprint(tenantId, attachmentId));
  }

  public record ContentFingerprint(Long size,String hash) {}
  public ContentFingerprint contentFingerprint(String tenantId,String attachmentId) {
    requireTenant(tenantId);var fingerprint=attachments.fingerprint(tenantId,attachmentId);
    return fingerprint==null?null:new ContentFingerprint(fingerprint.contentSize(),fingerprint.contentSha256());
  }

  private void requireTenant(String tenantId) {
    if (!TenantAccessGuard.requireTenantId("attachment review snapshot").equals(tenantId)) {
      throw new PermissionDeniedException("附件快照不属于当前租户");
    }
  }
}
