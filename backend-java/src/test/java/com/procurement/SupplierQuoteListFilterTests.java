package com.procurement;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.common.tenant.TenantContext;
import com.procurement.sourcing.api.UpdateQuoteRequest;
import com.procurement.sourcing.application.QuoteApplicationService;
import com.procurement.sourcing.domain.Quote;
import com.procurement.sourcing.domain.Rfq;
import com.procurement.sourcing.domain.RfqSourcingStatusTransition;
import com.procurement.sourcing.infrastructure.QuoteMapper;
import com.procurement.sourcing.infrastructure.RfqDemandMapper;
import com.procurement.sourcing.infrastructure.RfqInviteMapper;
import com.procurement.sourcing.infrastructure.RfqMapper;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class SupplierQuoteListFilterTests {

  private final RfqMapper rfqMapper = org.mockito.Mockito.mock(RfqMapper.class);
  private final RfqDemandMapper rfqDemandMapper = org.mockito.Mockito.mock(RfqDemandMapper.class);
  private final RfqInviteMapper rfqInviteMapper = org.mockito.Mockito.mock(RfqInviteMapper.class);
  private final QuoteMapper quoteMapper = org.mockito.Mockito.mock(QuoteMapper.class);
  private final QuoteApplicationService quoteApplicationService =
      new QuoteApplicationService(
          rfqMapper,
          rfqDemandMapper,
          rfqInviteMapper,
          quoteMapper,
          new RfqSourcingStatusTransition());

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
        6));

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

  private Quote quote(String id, BigDecimal amount, BigDecimal taxRate, Integer deliveryDays) {
    return new Quote(
        id,
        "tenant-1",
        "rfq-1",
        "ent-supplier-sunrise",
        amount,
        taxRate,
        deliveryDays,
        "已提交",
        OffsetDateTime.parse("2026-06-15T12:20:00+08:00"));
  }

  private Rfq rfq(String id, String status) {
    return new Rfq(
        id,
        "tenant-1",
        "办公设备询价",
        status,
        OffsetDateTime.parse("2026-07-01T18:00:00+08:00"),
        "buyer-user",
        null,
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"),
        OffsetDateTime.parse("2026-06-15T11:00:00+08:00"));
  }
}
