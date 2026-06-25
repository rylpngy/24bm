package com.procurement;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.attachment.api.CreateAttachmentRequest;
import com.procurement.attachment.api.CreateAttachmentUploadTicketRequest;
import com.procurement.attachment.application.AttachmentApplicationService;
import com.procurement.attachment.domain.Attachment;
import com.procurement.attachment.infrastructure.AttachmentMapper;
import com.procurement.audit.infrastructure.AuditLogMapper;
import com.procurement.common.tenant.TenantContext;
import com.procurement.sourcing.infrastructure.QuoteMapper;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class AttachmentMetadataLifecycleTests {

  private final AttachmentMapper attachmentMapper = org.mockito.Mockito.mock(AttachmentMapper.class);
  private final AuditLogMapper auditLogMapper = org.mockito.Mockito.mock(AuditLogMapper.class);
  private final QuoteMapper quoteMapper = org.mockito.Mockito.mock(QuoteMapper.class);
  private final AttachmentApplicationService attachmentApplicationService =
      new AttachmentApplicationService(attachmentMapper, auditLogMapper, quoteMapper, org.mockito.Mockito.mock(com.procurement.common.storage.ObjectStorageService.class));

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void createAttachmentRecordsVisibilityAndActiveStatusFromServerContext() {
    TenantContext.set("tenant-1", null, "buyer-1");
    when(quoteMapper.findByTenantAndId("tenant-1", "quote-1"))
        .thenReturn(new com.procurement.sourcing.domain.Quote(
            "quote-1",
            "tenant-1",
            "rfq-1",
            "supplier-1",
            java.math.BigDecimal.valueOf(100),
            java.math.BigDecimal.valueOf(13),
            7,
            "已提交",
            OffsetDateTime.parse("2026-06-15T09:30:00+08:00")));
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
  void createQuoteAttachmentRejectsUnknownCurrentTenantQuote() {
    TenantContext.set("tenant-1", null, "buyer-1");

    assertThatThrownBy(() -> attachmentApplicationService.createCurrentTenantAttachment(new CreateAttachmentRequest(
        "quote",
        "quote-missing",
        "报价单.xlsx",
        "tenant-1/quote/quote-missing/quote.xlsx",
        "supplier_shared")))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Quote attachment owner not found in tenant scope: quote-missing");

    verify(attachmentMapper, org.mockito.Mockito.never()).insert(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString());
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

  @Test
  void createsUploadTicketWithTenantScopedStorageKeyAndSignedUploadUrl() {
    TenantContext.set("tenant-1", null, "buyer-1");

    var ticket = attachmentApplicationService.createCurrentTenantUploadTicket(new CreateAttachmentUploadTicketRequest(
        "contract",
        "contract-1",
        "合同正文.pdf",
        "buyer_internal"));

    org.assertj.core.api.Assertions.assertThat(ticket.ownerType()).isEqualTo("contract");
    org.assertj.core.api.Assertions.assertThat(ticket.ownerId()).isEqualTo("contract-1");
    org.assertj.core.api.Assertions.assertThat(ticket.fileName()).isEqualTo("合同正文.pdf");
    org.assertj.core.api.Assertions.assertThat(ticket.storageKey())
        .startsWith("tenant-1/contract/contract-1/")
        .endsWith("合同正文.pdf");
    org.assertj.core.api.Assertions.assertThat(ticket.uploadUrl())
        .contains("/api/v1/buyer/attachments/upload-sink")
        .contains("storageKey=");
    org.assertj.core.api.Assertions.assertThat(ticket.expiresAt()).isAfter(ticket.createdAt());
  }

  @Test
  void createsDownloadLinkForTenantScopedAttachment() {
    TenantContext.set("tenant-1", null, "buyer-1");
    when(attachmentMapper.findByTenantAndId("tenant-1", "att-1"))
        .thenReturn(attachment("att-1", "buyer_internal", "active"));

    var link = attachmentApplicationService.createCurrentTenantDownloadLink("att-1");

    org.assertj.core.api.Assertions.assertThat(link.attachmentId()).isEqualTo("att-1");
    org.assertj.core.api.Assertions.assertThat(link.storageKey()).isEqualTo("tenant-1/quote/quote-1/quote.xlsx");
    org.assertj.core.api.Assertions.assertThat(link.downloadUrl())
        .contains("/api/v1/buyer/attachments/att-1/download")
        .contains("token=");
    org.assertj.core.api.Assertions.assertThat(link.expiresAt()).isAfter(link.createdAt());
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
