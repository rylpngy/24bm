package com.procurement;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.sourcing.api.SubmitQuoteRequest;
import com.procurement.sourcing.api.UpdateQuoteRequest;
import com.procurement.sourcing.application.QuoteApplicationService;
import com.procurement.sourcing.domain.Quote;
import com.procurement.sourcing.domain.QuoteStatus;
import com.procurement.sourcing.domain.Rfq;
import com.procurement.sourcing.domain.RfqSourcingStatusTransition;
import com.procurement.sourcing.infrastructure.QuoteLineItemMapper;
import com.procurement.sourcing.infrastructure.QuoteMapper;
import com.procurement.sourcing.infrastructure.RfqDemandMapper;
import com.procurement.sourcing.infrastructure.RfqInviteMapper;
import com.procurement.sourcing.infrastructure.RfqMapper;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DuplicateKeyException;

class SupplierQuoteListFilterTests {

  private final RfqMapper rfqMapper = org.mockito.Mockito.mock(RfqMapper.class);
  private final RfqDemandMapper rfqDemandMapper = org.mockito.Mockito.mock(RfqDemandMapper.class);
  private final RfqInviteMapper rfqInviteMapper = org.mockito.Mockito.mock(RfqInviteMapper.class);
  private final QuoteMapper quoteMapper = org.mockito.Mockito.mock(QuoteMapper.class);
  private final QuoteLineItemMapper quoteLineItemMapper =
      org.mockito.Mockito.mock(QuoteLineItemMapper.class);
  private final AuditLogApplicationService auditLogApplicationService =
      org.mockito.Mockito.mock(AuditLogApplicationService.class);
  private final NotificationApplicationService notificationApplicationService =
      org.mockito.Mockito.mock(NotificationApplicationService.class);
  private final QuoteApplicationService quoteApplicationService =
      new QuoteApplicationService(
          rfqMapper,
          rfqDemandMapper,
          rfqInviteMapper,
          quoteMapper,
          quoteLineItemMapper,
          new RfqSourcingStatusTransition(),
          auditLogApplicationService,
          notificationApplicationService);

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void listSupplierQuotesAppliesFiltersInsideCurrentSupplier() {
    TenantContext.set(null, "ent-supplier-sunrise", "user-supplier-sales");
    when(quoteMapper.listBySupplierFiltered("ent-supplier-sunrise", "rfq-demo", "已提交"))
        .thenReturn(List.of());

    quoteApplicationService.listSupplierQuotes("rfq-demo", "已提交");

    verify(quoteMapper).listBySupplierFiltered("ent-supplier-sunrise", "rfq-demo", "已提交");
  }

  @Test
  void updatesCurrentSupplierSubmittedQuoteWhileRfqIsQuoting() {
    TenantContext.set(null, "ent-supplier-sunrise", "user-supplier-sales");
    when(quoteMapper.findBySupplierAndId("ent-supplier-sunrise", "quote-1"))
        .thenReturn(quote("quote-1", BigDecimal.valueOf(118000), BigDecimal.valueOf(13), 7));
    when(rfqMapper.findBySupplierInvite("rfq-1", "ent-supplier-sunrise"))
        .thenReturn(rfq("rfq-1", "报价中"));
    when(rfqInviteMapper.isSupplierInvited("tenant-1", "rfq-1", "ent-supplier-sunrise"))
        .thenReturn(1);
    when(quoteMapper.updateSubmittedQuote(
            "tenant-1",
            "quote-1",
            "ent-supplier-sunrise",
            BigDecimal.valueOf(116000),
            BigDecimal.valueOf(13),
            6,
            "已提交"))
        .thenReturn(1);
    when(quoteMapper.findByTenantAndId("tenant-1", "quote-1"))
        .thenReturn(quote("quote-1", BigDecimal.valueOf(116000), BigDecimal.valueOf(13), 6));

    var response = quoteApplicationService.update("quote-1", new UpdateQuoteRequest(
        BigDecimal.valueOf(116000),
        BigDecimal.valueOf(13),
        6,
        null));

    org.assertj.core.api.Assertions.assertThat(response.amount()).isEqualByComparingTo("116000");
    org.assertj.core.api.Assertions.assertThat(response.deliveryDays()).isEqualTo(6);
    verify(quoteMapper).updateSubmittedQuote(
        "tenant-1",
        "quote-1",
        "ent-supplier-sunrise",
        BigDecimal.valueOf(116000),
        BigDecimal.valueOf(13),
        6,
        "已提交");
  }

  @Test
  void rejectsUpdatingLockedQuoteWithExplicitBusinessError() {
    TenantContext.set(null, "ent-supplier-sunrise", "user-supplier-sales");
    when(quoteMapper.findBySupplierAndId("ent-supplier-sunrise", "quote-1"))
        .thenReturn(quote(
            "quote-1",
            BigDecimal.valueOf(118000),
            BigDecimal.valueOf(13),
            7,
            QuoteStatus.LOCKED));
    when(rfqMapper.findBySupplierInvite("rfq-1", "ent-supplier-sunrise"))
        .thenReturn(rfq("rfq-1", "报价中"));
    when(rfqInviteMapper.isSupplierInvited("tenant-1", "rfq-1", "ent-supplier-sunrise"))
        .thenReturn(1);

    assertThatThrownBy(() -> quoteApplicationService.update("quote-1", new UpdateQuoteRequest(
        BigDecimal.valueOf(116000),
        BigDecimal.valueOf(13),
        6,
        null)))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Locked supplier quote cannot be updated: quote-1");

    verify(quoteMapper, never()).updateSubmittedQuote(
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.anyInt(),
        org.mockito.ArgumentMatchers.anyString());
  }

  @Test
  void rejectsSubmittingQuoteAfterRfqDeadline() {
    TenantContext.set(null, "ent-supplier-sunrise", "user-supplier-sales");
    when(rfqMapper.findBySupplierInvite("rfq-1", "ent-supplier-sunrise"))
        .thenReturn(rfq("rfq-1", "报价中", OffsetDateTime.now().minusMinutes(1)));
    when(rfqInviteMapper.isSupplierInvited("tenant-1", "rfq-1", "ent-supplier-sunrise"))
        .thenReturn(1);

    assertThatThrownBy(() -> quoteApplicationService.submit("rfq-1", new SubmitQuoteRequest(
        BigDecimal.valueOf(116000),
        BigDecimal.valueOf(13),
        6,
        null)))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("RFQ quote deadline has passed: rfq-1");

    verify(quoteMapper, never()).insert(
        anyString(),
        eq("tenant-1"),
        eq("rfq-1"),
        eq("ent-supplier-sunrise"),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.anyInt(),
        eq("已提交"),
        org.mockito.ArgumentMatchers.anyInt());
  }

  @Test
  void translatesConcurrentDuplicateQuoteInsertIntoBusinessError() {
    TenantContext.set(null, "ent-supplier-sunrise", "user-supplier-sales");
    when(rfqMapper.findBySupplierInvite("rfq-1", "ent-supplier-sunrise"))
        .thenReturn(rfq("rfq-1", "报价中"));
    when(rfqInviteMapper.isSupplierInvited("tenant-1", "rfq-1", "ent-supplier-sunrise"))
        .thenReturn(1);
    when(quoteMapper.countSubmittedBySupplier("tenant-1", "rfq-1", "ent-supplier-sunrise", 1))
        .thenReturn(0);
    doThrow(new DuplicateKeyException("duplicate supplier quote"))
        .when(quoteMapper)
        .insert(
            anyString(),
            eq("tenant-1"),
            eq("rfq-1"),
            eq("ent-supplier-sunrise"),
            eq(BigDecimal.valueOf(116000)),
            eq(BigDecimal.valueOf(13)),
            eq(6),
            eq("已提交"),
            eq(1));

    assertThatThrownBy(() -> quoteApplicationService.submit("rfq-1", new SubmitQuoteRequest(
        BigDecimal.valueOf(116000),
        BigDecimal.valueOf(13),
        6,
        null)))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Supplier has already submitted a quote: rfq-1");
  }

  private Quote quote(String id, BigDecimal amount, BigDecimal taxRate, Integer deliveryDays) {
    return quote(id, amount, taxRate, deliveryDays, QuoteStatus.SUBMITTED);
  }

  private Quote quote(String id, BigDecimal amount, BigDecimal taxRate, Integer deliveryDays, String status) {
    return new Quote(
        id,
        "tenant-1",
        "rfq-1",
        "ent-supplier-sunrise",
        amount,
        taxRate,
        deliveryDays,
        status,
        OffsetDateTime.parse("2026-06-15T12:20:00+08:00"));
  }

  private Rfq rfq(String id, String status) {
    return rfq(id, status, OffsetDateTime.now().plusDays(7));
  }

  private Rfq rfq(String id, String status, OffsetDateTime deadlineAt) {
    return new Rfq(
        id,
        "tenant-1",
        "办公设备询价",
        status,
        deadlineAt,
        "buyer-user",
        null,
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"),
        OffsetDateTime.parse("2026-06-15T11:00:00+08:00"), "", "", "最低价", null, 1, false, "询价", null);
  }
}
