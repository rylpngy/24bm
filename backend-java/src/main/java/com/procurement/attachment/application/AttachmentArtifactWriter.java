package com.procurement.attachment.application;

import com.procurement.attachment.infrastructure.AttachmentMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.storage.ObjectStorageService;
import com.procurement.common.tenant.TenantAccessGuard;
import java.security.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Internal generated-artifact import. Business owner policy still authorizes and checks the bytes.
 */
@Service
public class AttachmentArtifactWriter {
  private final AttachmentMapper mapper;
  private final AttachmentAccessService access;
  private final ObjectStorageService storage;
  private final AuditLogApplicationService audit;

  public AttachmentArtifactWriter(
      AttachmentMapper mapper,
      AttachmentAccessService access,
      ObjectStorageService storage,
      AuditLogApplicationService audit) {
    this.mapper = mapper;
    this.access = access;
    this.storage = storage;
    this.audit = audit;
  }

  public record Artifact(String attachmentId, String hash, long size) {}

  @Transactional
  public Artifact write(String type, String owner, String name, String mime, byte[] bytes) {
    String tenant = TenantAccessGuard.requireTenantId("generated artifact"),
        actor = TenantAccessGuard.requireUserId("generated artifact");
    access.requireAccess(type, owner, true);
    access.validateUpload(type, owner, name, bytes);
    String id = "att-" + UUID.randomUUID(),
        key = tenant + "/" + type + "/" + owner + "/" + UUID.randomUUID() + ".docx";
    storage.put(key, bytes, mime);
    String hash;
    try {
      hash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException(e);
    }
    mapper.insert(id, tenant, type, owner, name, key, actor, "buyer_internal", "active");
    if (mapper.generatedFingerprint(tenant, id, bytes.length, hash) != 1)
      throw new IllegalStateException("生成附件哈希保存失败");
    audit.recordTenantAction("attachment.generated", type, owner);
    return new Artifact(id, hash, bytes.length);
  }
}
