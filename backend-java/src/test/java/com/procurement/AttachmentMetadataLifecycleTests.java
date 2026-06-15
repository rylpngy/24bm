package com.procurement;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.attachment.api.CreateAttachmentRequest;
import com.procurement.attachment.application.AttachmentApplicationService;
import com.procurement.attachment.domain.Attachment;
import com.procurement.attachment.infrastructure.AttachmentMapper;
import com.procurement.audit.infrastructure.AuditLogMapper;
import com.procurement.common.tenant.TenantContext;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class AttachmentMetadataLifecycleTests {

  private final AttachmentMapper attachmentMapper = org.mockito.Mockito.mock(AttachmentMapper.class);
  private final AuditLogMapper auditLogMapper = org.mockito.Mockito.mock(AuditLogMapper.class);
  private final AttachmentApplicationService attachmentApplicationService =
      new AttachmentApplicationService(attachmentMapper, auditLogMapper);

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void createAttachmentRecordsVisibilityAndActiveStatusFromServerContext() {
    TenantContext.set("tenant-1", null, "buyer-1");
    when(attachmentMapper.findByTenantAndId(
            org.mockito.ArgumentMatchers.eq("tenant-1"),
            org.mockito.ArgumentMatchers.anyString()))
        .thenAnswer(invocation -> attachment(invocation.getArgument(1), "supplier_shared", "active"));

    attachmentApplicationService.createCurrentTenantAttachment(new CreateAttachmentRequest(
        "quote",
        "quote-1",
        "报价单.xlsx",
        "tenant-1/quote/quote-1/quote.xlsx",
        "supplier_shared"));

    verify(attachmentMapper).insert(
        org.mockito.ArgumentMatchers.<String>argThat(id -> id != null && id.startsWith("att-")),
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("quote"),
        org.mockito.ArgumentMatchers.eq("quote-1"),
        org.mockito.ArgumentMatchers.eq("报价单.xlsx"),
        org.mockito.ArgumentMatchers.eq("tenant-1/quote/quote-1/quote.xlsx"),
        org.mockito.ArgumentMatchers.eq("buyer-1"),
        org.mockito.ArgumentMatchers.eq("supplier_shared"),
        org.mockito.ArgumentMatchers.eq("active"));
  }

  @Test
  void createAttachmentRejectsUnsupportedVisibility() {
    TenantContext.set("tenant-1", null, "buyer-1");

    assertThatThrownBy(() -> attachmentApplicationService.createCurrentTenantAttachment(new CreateAttachmentRequest(
        "purchase_demand",
        "demand-1",
        "需求规格书.pdf",
        "tenant-1/purchase_demand/demand-1/spec.pdf",
        "public")))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Unsupported attachment visibility");
  }

  @Test
  void listAttachmentsReadsOnlyActiveMetadataInCurrentTenant() {
    TenantContext.set("tenant-1", null, "buyer-1");

    attachmentApplicationService.listCurrentTenantAttachments("purchase_demand", "demand-1");

    verify(attachmentMapper).listActiveByTenantAndOwner("tenant-1", "purchase_demand", "demand-1");
  }

  private Attachment attachment(String id, String visibility, String status) {
    return new Attachment(
        id,
        "tenant-1",
        "quote",
        "quote-1",
        "报价单.xlsx",
        "tenant-1/quote/quote-1/quote.xlsx",
        "buyer-1",
        visibility,
        status,
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"));
  }
}
