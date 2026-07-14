package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.domain.AuditTargetType;
import com.procurement.common.tenant.TenantContext;
import com.procurement.identity.domain.BuyerUser;
import com.procurement.identity.infrastructure.BuyerUserMapper;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.notification.domain.NotificationTitle;
import com.procurement.notification.infrastructure.NotificationMapper;
import com.procurement.sourcing.api.SubmitQuoteRequest;
import com.procurement.sourcing.api.UpdateQuoteRequest;
import com.procurement.sourcing.application.QuoteApplicationService;
import com.procurement.sourcing.domain.Quote;
import com.procurement.sourcing.domain.QuoteAuditAction;
import com.procurement.sourcing.domain.Rfq;
import com.procurement.sourcing.domain.RfqSourcingStatusTransition;
import com.procurement.sourcing.api.QuoteLineItemRequest;
import com.procurement.sourcing.domain.QuoteLineItem;
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

class SupplierQuoteAuditLogTests {

  private final RfqMapper rfqMapper = org.mockito.Mockito.mock(RfqMapper.class);
  private final RfqDemandMapper rfqDemandMapper = org.mockito.Mockito.mock(RfqDemandMapper.class);
  private final RfqInviteMapper rfqInviteMapper = org.mockito.Mockito.mock(RfqInviteMapper.class);
  private final QuoteMapper quoteMapper = org.mockito.Mockito.mock(QuoteMapper.class);
  private final QuoteLineItemMapper quoteLineItemMapper =
      org.mockito.Mockito.mock(QuoteLineItemMapper.class);
  private final AuditLogApplicationService auditLogApplicationService =
      org.mockito.Mockito.mock(AuditLogApplicationService.class);
  private final NotificationMapper notificationMapper = org.mockito.Mockito.mock(NotificationMapper.class);
  private final BuyerUserMapper buyerUserMapper = org.mockito.Mockito.mock(BuyerUserMapper.class);
  private final NotificationApplicationService notificationApplicationService =
      new NotificationApplicationService(notificationMapper, buyerUserMapper);
  private final QuoteApplicationService quoteApplicationService =
      new QuoteApplicationService(
          rfqMapper,
          rfqDemandMapper,
          rfqInviteMapper,
          quoteMapper,
          quoteLineItemMapper,
          new RfqSourcingStatusTransition(),
          org.mockito.Mockito.mock(com.procurement.sourcing.application.RfqItemQueryService.class),
          auditLogApplicationService,
          notificationApplicationService);

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void submittingSupplierQuoteRecordsAuditLogForCreatedQuote() {
    TenantContext.set(null, "ent-supplier-sunrise", "user-supplier-sales");
    when(rfqMapper.findBySupplierInvite("rfq-1", "ent-supplier-sunrise"))
        .thenReturn(rfq("rfq-1", "报价中"));
    when(rfqInviteMapper.isSupplierInvited("tenant-1", "rfq-1", "ent-supplier-sunrise"))
        .thenReturn(1);
    when(quoteMapper.countSubmittedBySupplier("tenant-1", "rfq-1", "ent-supplier-sunrise", 1))
        .thenReturn(0);
    when(quoteMapper.findByTenantAndId(eq("tenant-1"), anyString()))
        .thenAnswer(invocation -> quote(invocation.getArgument(1), BigDecimal.valueOf(116000), BigDecimal.valueOf(13), 6));

    var response = quoteApplicationService.submit("rfq-1", new SubmitQuoteRequest(
        BigDecimal.valueOf(116000),
        BigDecimal.valueOf(13),
        6,
        null));

    assertThat(response.id()).startsWith("quote-");
    verify(auditLogApplicationService)
        .recordTenantAction("tenant-1", QuoteAuditAction.SUBMITTED, AuditTargetType.QUOTE, response.id());
  }

  @Test
  void submittingQuoteWithLineItemsDerivesAmountAndPersistsLines() {
    TenantContext.set(null, "ent-supplier-sunrise", "user-supplier-sales");
    when(rfqMapper.findBySupplierInvite("rfq-1", "ent-supplier-sunrise"))
        .thenReturn(rfq("rfq-1", "报价中"));
    when(rfqInviteMapper.isSupplierInvited("tenant-1", "rfq-1", "ent-supplier-sunrise"))
        .thenReturn(1);
    when(quoteMapper.countSubmittedBySupplier("tenant-1", "rfq-1", "ent-supplier-sunrise", 1))
        .thenReturn(0);
    when(quoteMapper.findByTenantAndId(eq("tenant-1"), anyString()))
        .thenAnswer(invocation -> quote(invocation.getArgument(1), BigDecimal.valueOf(118000), BigDecimal.valueOf(13), 7));
    when(quoteLineItemMapper.listByQuote(eq("tenant-1"), anyString()))
        .thenReturn(List.of(
            new QuoteLineItem("qli-a", "tenant-1", "quote-x", "服务器", "台",
                BigDecimal.valueOf(10), BigDecimal.valueOf(9800), BigDecimal.valueOf(98000), 0, null),
            new QuoteLineItem("qli-b", "tenant-1", "quote-x", "交换机", "台",
                BigDecimal.valueOf(8), BigDecimal.valueOf(2500), BigDecimal.valueOf(20000), 1, null)));

    // 头金额故意填 1,验证服务端按行汇总(98000 + 20000 = 118000)覆盖。
    var response = quoteApplicationService.submit("rfq-1", new SubmitQuoteRequest(
        BigDecimal.ONE,
        BigDecimal.valueOf(13),
        7,
        List.of(
            new QuoteLineItemRequest("服务器", "台", BigDecimal.valueOf(10), BigDecimal.valueOf(9800), null),
            new QuoteLineItemRequest("交换机", "台", BigDecimal.valueOf(8), BigDecimal.valueOf(2500), null))));

    verify(quoteMapper).insert(
        anyString(), eq("tenant-1"), eq("rfq-1"), eq("ent-supplier-sunrise"),
        org.mockito.ArgumentMatchers.argThat(a -> a.compareTo(BigDecimal.valueOf(118000)) == 0),
        eq(BigDecimal.valueOf(13)), eq(7), eq("已提交"), eq(1));
    verify(quoteLineItemMapper).deleteByQuote(eq("tenant-1"), anyString());
    verify(quoteLineItemMapper, org.mockito.Mockito.times(2))
        .insert(anyString(), eq("tenant-1"), anyString(), anyString(), eq("台"),
            org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyInt(),
            org.mockito.ArgumentMatchers.any());
    assertThat(response.lineItems()).hasSize(2);
    assertThat(response.lineItems().get(0).lineAmount()).isEqualByComparingTo("98000");
  }

  @Test
  void submittingSupplierQuoteNotifiesActiveBuyerUsers() {
    TenantContext.set(null, "ent-supplier-sunrise", "user-supplier-sales");
    when(rfqMapper.findBySupplierInvite("rfq-1", "ent-supplier-sunrise"))
        .thenReturn(rfq("rfq-1", "报价中"));
    when(rfqInviteMapper.isSupplierInvited("tenant-1", "rfq-1", "ent-supplier-sunrise"))
        .thenReturn(1);
    when(quoteMapper.countSubmittedBySupplier("tenant-1", "rfq-1", "ent-supplier-sunrise", 1))
        .thenReturn(0);
    when(quoteMapper.findByTenantAndId(eq("tenant-1"), anyString()))
        .thenAnswer(invocation -> quote(invocation.getArgument(1), BigDecimal.valueOf(116000), BigDecimal.valueOf(13), 6));
    when(buyerUserMapper.listByTenant("tenant-1")).thenReturn(List.of(
        buyerUser("buyer-user-active", "active"),
        buyerUser("buyer-user-disabled", "inactive")));

    quoteApplicationService.submit("rfq-1", new SubmitQuoteRequest(
        BigDecimal.valueOf(116000),
        BigDecimal.valueOf(13),
        6,
        null));

    verify(notificationMapper).insert(
        org.mockito.ArgumentMatchers.<String>argThat(id -> id != null && id.startsWith("notice-")),
        eq("tenant-1"),
        eq("buyer-user-active"),
        eq(NotificationTitle.SUPPLIER_QUOTE_SUBMITTED),
        eq("办公设备询价已收到供应商报价，请进入报价对比处理。"));
    verify(notificationMapper, org.mockito.Mockito.never()).insert(
        anyString(),
        eq("tenant-1"),
        eq("buyer-user-disabled"),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString());
  }

  @Test
  void updatingSupplierQuoteRecordsAuditLogForExistingQuote() {
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

    assertThat(response.id()).isEqualTo("quote-1");
    verify(auditLogApplicationService)
        .recordTenantAction("tenant-1", QuoteAuditAction.UPDATED, AuditTargetType.QUOTE, "quote-1");
  }

  @Test
  void updatingSupplierQuoteNotifiesActiveBuyerUsers() {
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
    when(buyerUserMapper.listByTenant("tenant-1")).thenReturn(List.of(
        buyerUser("buyer-user-active", "active"),
        buyerUser("buyer-user-disabled", "inactive")));

    quoteApplicationService.update("quote-1", new UpdateQuoteRequest(
        BigDecimal.valueOf(116000),
        BigDecimal.valueOf(13),
        6,
        null));

    verify(notificationMapper).insert(
        org.mockito.ArgumentMatchers.<String>argThat(id -> id != null && id.startsWith("notice-")),
        eq("tenant-1"),
        eq("buyer-user-active"),
        eq(NotificationTitle.SUPPLIER_QUOTE_SUBMITTED),
        eq("办公设备询价供应商报价已更新，请重新查看报价对比。"));
    verify(notificationMapper, org.mockito.Mockito.never()).insert(
        anyString(),
        eq("tenant-1"),
        eq("buyer-user-disabled"),
        org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString());
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
        OffsetDateTime.now().plusDays(7),
        "buyer-user",
        null,
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"),
        OffsetDateTime.parse("2026-06-15T11:00:00+08:00"), "", "", "最低价", null, 1, false, "询价", null, null, null, null, null, null, null, null, null, null, null, null);
  }

  private BuyerUser buyerUser(String id, String status) {
    return new BuyerUser(
        id,
        "tenant-1",
        "采购用户",
        "13800000001",
        id + "@example.com",
        status,
        "dept-it",
        "role-buyer-owner");
  }
}
