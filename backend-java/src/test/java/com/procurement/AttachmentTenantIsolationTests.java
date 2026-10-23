package com.procurement;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.procurement.attachment.api.CreateAttachmentRequest;
import com.procurement.attachment.application.AttachmentApplicationService;
import com.procurement.attachment.domain.Attachment;
import com.procurement.attachment.infrastructure.AttachmentMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.attachment.application.AttachmentAccessService;
import com.procurement.attachment.infrastructure.AttachmentUploadTicketMapper;
import com.procurement.common.storage.ObjectStorageService;
import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.common.tenant.TenantContext;
import com.procurement.sourcing.infrastructure.QuoteMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class AttachmentTenantIsolationTests {
  private final AttachmentMapper attachments = mock(AttachmentMapper.class);
  private final AuditLogApplicationService audit = mock(AuditLogApplicationService.class);
  private final ObjectStorageService storage = mock(ObjectStorageService.class);
  private final AttachmentApplicationService service = new AttachmentApplicationService(
      attachments, audit, mock(AttachmentAccessService.class), storage, mock(AttachmentUploadTicketMapper.class));

  @AfterEach
  void clearContext() { TenantContext.clear(); }

  @ParameterizedTest
  @ValueSource(strings = {"tenant-b/file", "tenant-a-other/file", "tenant-a/../tenant-b/file",
      "tenant-a/./file", "tenant-a//file", "tenant-a/", "tenant-a/path\\file"})
  void rejectsForeignAndNonCanonicalKeysBeforeAnyStorageAccess(String key) {
    TenantContext.set("tenant-a", null, "user-a");
    assertThatThrownBy(() -> service.createCurrentTenantAttachment(
        new CreateAttachmentRequest("demand", "draft", "file", key, "private")))
        .isInstanceOf(PermissionDeniedException.class);
    assertThatThrownBy(() -> service.storeCurrentTenantObject(key, "token", new byte[0], "text/plain"))
        .isInstanceOf(PermissionDeniedException.class);
    verifyNoInteractions(attachments, audit, storage);
  }

  @Test
  void rejectsLegacyCrossTenantMetadataAtDownloadBoundary() {
    TenantContext.set("tenant-a", null, "user-a");
    when(attachments.findByTenantAndId("tenant-a", "att-a")).thenReturn(new Attachment(
        "att-a", "tenant-a", "demand", "draft", "file", "tenant-b/file", "user-a", "private", "active", null));
    assertThatThrownBy(() -> service.loadCurrentTenantObject("att-a"))
        .isInstanceOf(PermissionDeniedException.class);
    assertThatThrownBy(() -> service.createCurrentTenantDownloadLink("att-a"))
        .isInstanceOf(PermissionDeniedException.class);
    verifyNoInteractions(storage);
  }

  @Test
  void rejectsCanonicalPathWithoutAnIssuedTicket() {
    TenantContext.set("tenant-a", null, "user-a");
    byte[] data = {1, 2, 3};
    assertThatThrownBy(() -> service.storeCurrentTenantObject("tenant-a/demand/draft/file", "token", data, "text/plain"))
        .isInstanceOf(PermissionDeniedException.class);
    verifyNoInteractions(storage);
  }

  @Test
  void rejectsLegacyMetadataPointingAtAnotherBusinessOwnersStorage() {
    TenantContext.set("tenant-a", null, "user-a");
    when(attachments.findByTenantAndId("tenant-a", "att-a")).thenReturn(new Attachment(
        "att-a", "tenant-a", "demand", "mine", "file", "tenant-a/demand/other/file", "user-a", "tenant", "active", null));
    assertThatThrownBy(() -> service.loadCurrentTenantObject("att-a")).isInstanceOf(PermissionDeniedException.class);
    assertThatThrownBy(() -> service.createCurrentTenantDownloadLink("att-a")).isInstanceOf(PermissionDeniedException.class);
    verifyNoInteractions(storage);
  }
}
