package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

import com.procurement.attachment.application.AttachmentAccessService;
import com.procurement.attachment.application.AttachmentApplicationService;
import com.procurement.attachment.domain.Attachment;
import com.procurement.attachment.infrastructure.AttachmentMapper;
import com.procurement.attachment.infrastructure.AttachmentUploadTicketMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.storage.ObjectStorageService;
import com.procurement.common.storage.StoredObjectMissingException;
import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.common.tenant.TenantContext;
import java.security.MessageDigest;
import java.util.HexFormat;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class AttachmentIntegrityTests {
  final AttachmentMapper attachments = mock(AttachmentMapper.class);
  final AttachmentAccessService access = mock(AttachmentAccessService.class);
  final ObjectStorageService storage = mock(ObjectStorageService.class);
  final AttachmentApplicationService service = new AttachmentApplicationService(attachments,
      mock(AuditLogApplicationService.class), access, storage, mock(AttachmentUploadTicketMapper.class));
  final String key = "tenant/purchase_demand/d1/file.txt";

  @BeforeEach void prepare() {
    TenantContext.set("tenant", null, "reader");
    when(attachments.findByTenantAndId("tenant", "a1")).thenReturn(attachment(key));
    when(storage.get(key)).thenReturn(new ObjectStorageService.StoredObject(new byte[]{1,2,3}, "text/plain"));
  }
  @AfterEach void clear() { TenantContext.clear(); }
  Attachment attachment(String path) {
    return new Attachment("a1", "tenant", "purchase_demand", "d1", "file.txt", path, "writer", "buyer_internal", "active", null);
  }
  @Test void verifiesUploadBaselineAndAllowsIdenticalDownload() throws Exception {
    String hash = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(new byte[]{1,2,3}));
    when(attachments.fingerprint("tenant", "a1")).thenReturn(new AttachmentMapper.Fingerprint(3L, hash));
    assertThat(service.checkCurrentTenantIntegrity("a1").status()).isEqualTo("verified");
    assertThat(service.loadCurrentTenantObject("a1").data()).containsExactly(1,2,3);
  }
  @Test void sameSizeDifferentContentIsBlocked() {
    when(attachments.fingerprint("tenant", "a1")).thenReturn(new AttachmentMapper.Fingerprint(3L, "0".repeat(64)));
    assertThat(service.checkCurrentTenantIntegrity("a1").status()).isEqualTo("mismatch");
    assertThatThrownBy(() -> service.loadCurrentTenantObject("a1")).isInstanceOf(IllegalStateException.class).hasMessageContaining("已阻止下载");
  }
  @Test void legacyPresenceIsNotReportedAsIntegrityVerified() {
    var result = service.checkCurrentTenantIntegrity("a1");
    assertThat(result.status()).isEqualTo("unverified");
    assertThat(result.expectedSize()).isNull();
    assertThat(result.actualSize()).isEqualTo(3);
  }
  @Test void separatesMissingObjectFromStorageOutage() {
    when(storage.get(key)).thenThrow(new StoredObjectMissingException(null));
    assertThat(service.checkCurrentTenantIntegrity("a1").status()).isEqualTo("missing");
    doThrow(new IllegalStateException("storage offline")).when(storage).get(key);
    assertThat(service.checkCurrentTenantIntegrity("a1").status()).isEqualTo("unavailable");
  }
  @Test void invalidLegacyPathIsReportedWithoutReadingAnObject() {
    when(attachments.findByTenantAndId("tenant", "a1")).thenReturn(attachment("other/file"));
    assertThat(service.checkCurrentTenantIntegrity("a1").status()).isEqualTo("invalid_path");
    verifyNoInteractions(storage);
  }
  @Test void scopeDenialPreventsEvenIntegrityDisclosure() {
    doThrow(new PermissionDeniedException("denied")).when(access).requireAccess("purchase_demand", "d1", false);
    assertThatThrownBy(() -> service.checkCurrentTenantIntegrity("a1")).isInstanceOf(PermissionDeniedException.class);
    verifyNoInteractions(storage);
    verify(attachments, never()).fingerprint(anyString(), anyString());
  }
}
