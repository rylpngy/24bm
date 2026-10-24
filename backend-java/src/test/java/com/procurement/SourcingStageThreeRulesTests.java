package com.procurement;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.demand.application.DirectDemandRegistrar;
import com.procurement.demand.infrastructure.PurchaseDemandMapper;
import com.procurement.identity.application.DataScopeService;
import com.procurement.identity.domain.DataScope;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.sourcing.api.*;
import com.procurement.sourcing.application.*;
import com.procurement.sourcing.domain.*;
import com.procurement.sourcing.infrastructure.*;
import com.procurement.supplier.domain.SupplierQualification;
import com.procurement.supplier.infrastructure.*;
import com.procurement.tenant.application.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class SourcingStageThreeRulesTests {
  final RfqMapper rfqs = mock(RfqMapper.class);
  final QuoteMapper quotes = mock(QuoteMapper.class);
  final QuoteLineItemMapper lines = mock(QuoteLineItemMapper.class);
  final RfqInviteMapper invites = mock(RfqInviteMapper.class);
  final RfqDemandMapper demands = mock(RfqDemandMapper.class);
  final PurchaseDemandMapper purchaseDemands = mock(PurchaseDemandMapper.class);
  final DataScopeService scopes = TestDataScopes.unrestricted();
  final BuyerSupplierRelationMapper relations = mock(BuyerSupplierRelationMapper.class);
  final SupplierQualificationMapper qualifications = mock(SupplierQualificationMapper.class);
  final RfqItemQueryService items = mock(RfqItemQueryService.class);
  final AuditLogApplicationService audit = mock(AuditLogApplicationService.class);
  final NotificationApplicationService notifications = mock(NotificationApplicationService.class);
  final RfqApplicationService service = new RfqApplicationService(rfqs, quotes, lines, demands, invites,
      purchaseDemands, mock(DirectDemandRegistrar.class), scopes, relations, qualifications,
      mock(TenantFeatureApplicationService.class), mock(TenantCapabilityApplicationService.class),
      new RfqSourcingStatusTransition(), items, audit, notifications, null);

  @AfterEach void clear() { TenantContext.clear(); }

  static Rfq rfq(String method, String status, String reason) {
    return rfq(method, status, reason, null);
  }

  static Rfq rfq(String method, String status, String reason, OffsetDateTime start) {
    return new Rfq("r", "t", "project", status, OffsetDateTime.now().plusHours(1), "u", null,
        OffsetDateTime.now(), OffsetDateTime.now(), "", "", "最低价", null, 2, false, method, null,
        "竞价".equals(method) ? new BigDecimal("100") : null, null, reason,
        null, null, start, 0, 0, true, true, false);
  }

  QuoteApplicationService quoteService() {
    return new QuoteApplicationService(rfqs, demands, invites, quotes, lines,
        new RfqSourcingStatusTransition(), items, audit, notifications,
        mock(org.springframework.context.ApplicationEventPublisher.class));
  }

  @Test void supplierStreamReadFilterRechecksInvitationWithoutThreadLocalContextOrWrites() {
    TenantContext.set(null, "s1", "supplier-user");
    var filter = service.currentSupplierReadFilter();
    when(rfqs.findBySupplierInvite("r", "s1")).thenReturn(rfq("竞价", "报价中", null), null);
    TenantContext.clear();
    assertThat(filter.test("r")).isTrue();
    assertThat(filter.test("r")).isFalse();
    assertThat(filter.test("other")).isFalse();
    verify(rfqs, never()).lockByTenantAndId(any(), any());
  }

  private SupplierQualification qualification() {
    return new SupplierQualification("qualification", "supplier", "营业执照", "CERT-001",
        java.time.LocalDate.of(2099, 1, 1), "license.pdf", "qualifications/license.pdf", "active",
        OffsetDateTime.parse("2026-10-24T00:00:00Z"));
  }

  @Test void singleSourceCreateAsDraftCannotSmuggleMultipleInvitations() {
    TenantContext.set("t", null, "u");
    when(purchaseDemands.findByTenantAndId("t", "d")).thenReturn(new com.procurement.demand.domain.PurchaseDemand(
        "d", "t", "demand", "dept", "u", BigDecimal.TEN, "已通过", null, null, null, null, null, null));
    when(relations.countByTenantSupplierAndStatus(any(), any(), any())).thenReturn(1);
    when(qualifications.listActiveBySupplier(any())).thenReturn(List.of(qualification()));
    assertThatThrownBy(() -> service.create(new CreateRfqRequest("project", List.of("d"), List.of("s1", "s2"),
        OffsetDateTime.now().plusDays(1), "", "", "最低价", "单一来源", null, null, "专有配套", true,
        null, null, null, null, null, null, null, null, null, null)))
        .isInstanceOf(IllegalStateException.class).hasMessageContaining("1 家");
    verify(rfqs, never()).insert(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(),
        any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
  }

  @Test void auctionCannotForceOpenAndLocksBeforeCheckingDeadline() {
    TenantContext.set("t", null, "u");
    when(rfqs.findByTenantAndId("t", "r")).thenReturn(rfq("竞价", "报价中", null));
    assertThatThrownBy(() -> service.openBids("r", true)).isInstanceOf(IllegalStateException.class);
    var order = inOrder(rfqs);
    order.verify(rfqs).lockByTenantAndId("t", "r");
    order.verify(rfqs).findByTenantAndId("t", "r");
    verify(rfqs, never()).openBids(any(), any(), any(), any(), any());
  }

  @Test void singleSourceDraftCannotHaveTwoSuppliersThroughEitherUpdateEntry() {
    TenantContext.set("t", null, "u");
    when(rfqs.findByTenantAndId("t", "r")).thenReturn(rfq("单一来源", "草稿", "专有配套"));
    when(relations.countByTenantSupplierAndStatus(any(), any(), any())).thenReturn(1);
    when(qualifications.listActiveBySupplier(any())).thenReturn(List.of(qualification()));
    assertThatThrownBy(() -> service.updateDraftInvitations("r", List.of("s1", "s2")))
        .isInstanceOf(IllegalStateException.class).hasMessageContaining("1 家");
    assertThatThrownBy(() -> service.update("r", new UpdateRfqRequest("project", List.of("s1", "s2"),
        OffsetDateTime.now().plusDays(1), "", "", "最低价")))
        .isInstanceOf(IllegalStateException.class).hasMessageContaining("1 家");
    verify(invites, never()).deleteByRfq(any(), any());
  }

  @Test void singleSourcePublishAndAwardRecheckReasonUniqueSupplierAndAdmission() {
    TenantContext.set("t", null, "u");
    when(rfqs.findByTenantAndId("t", "r")).thenReturn(rfq("单一来源", "草稿", "专有配套"));
    when(invites.listSupplierIds("t", "r")).thenReturn(List.of("s1", "s2"));
    assertThatThrownBy(() -> service.publish("r")).isInstanceOf(IllegalStateException.class);
    assertThatThrownBy(() -> service.requireAwardSupplier(rfq("单一来源", "已开标", "专有配套"), "s1"))
        .isInstanceOf(IllegalStateException.class);
    when(invites.listSupplierIds("t", "r")).thenReturn(List.of("s1"));
    assertThatThrownBy(() -> service.requireAwardSupplier(rfq("单一来源", "已开标", null), "s1"))
        .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("来源说明");
    assertThatThrownBy(() -> service.requireAwardSupplier(rfq("单一来源", "已开标", "专有配套"), "s2"))
        .isInstanceOf(IllegalStateException.class).hasMessageContaining("受邀方");
    assertThatThrownBy(() -> service.requireAwardSupplier(rfq("单一来源", "已开标", "专有配套"), "s1"))
        .isInstanceOf(IllegalStateException.class);
  }

  @Test void publicEnrollmentCannotAddSecondSingleSourceSupplier() {
    TenantContext.set("t", null, "u");
    when(rfqs.findByTenantAndId("t", "r")).thenReturn(rfq("单一来源", "报价中", "专有配套"));
    when(invites.listSupplierIds("t", "r")).thenReturn(List.of("s1"));
    assertThatThrownBy(() -> service.requireAdditionalInvitation("r", "s2"))
        .isInstanceOf(IllegalStateException.class).hasMessageContaining("追加供应商");
  }

  @Test void publishedAuctionCannotShortenDeadlineOrReplaceInvitations() {
    TenantContext.set("t", null, "u");
    var project = rfq("竞价", "报价中", null);
    when(rfqs.findByTenantAndId("t", "r")).thenReturn(project);
    when(invites.listSupplierIds("t", "r")).thenReturn(List.of("s1"));
    assertThatThrownBy(() -> service.update("r", new UpdateRfqRequest("project", null,
        project.deadlineAt().minusMinutes(1), "", "", "最低价")))
        .isInstanceOf(IllegalStateException.class).hasMessageContaining("缩短");
    when(relations.countByTenantSupplierAndStatus(any(), any(), any())).thenReturn(1);
    when(qualifications.listActiveBySupplier(any())).thenReturn(List.of(qualification()));
    assertThatThrownBy(() -> service.update("r", new UpdateRfqRequest("project", List.of("s2"),
        project.deadlineAt().plusHours(1), "", "", "最低价")))
        .isInstanceOf(IllegalStateException.class).hasMessageContaining("更换");
    verify(invites, never()).deleteByRfq(any(), any());
  }

  @Test void auctionBidSubmissionRejectsBeforePlannedStart() {
    TenantContext.set(null, "s1", "supplier-user");
    when(rfqs.findBySupplierInvite("r", "s1"))
        .thenReturn(rfq("竞价", "报价中", null, OffsetDateTime.now().plusMinutes(20)));
    when(invites.isSupplierInvited("t", "r", "s1")).thenReturn(1);
    assertThatThrownBy(() -> quoteService().submit("r", new SubmitQuoteRequest(BigDecimal.TEN, BigDecimal.ONE, 1, null)))
        .isInstanceOf(IllegalStateException.class).hasMessageContaining("计划开始");
    verifyNoInteractions(quotes);
  }

  @Test void unopenedSupplierRfqOnlyReturnsOwnCurrentRoundQuotesAndHidesCompetitorIds() {
    TenantContext.set(null, "s1", "supplier-user");
    when(rfqs.listBySupplierInvite("s1")).thenReturn(List.of(rfq("竞价", "报价中", null)));
    when(quotes.listByTenantAndRfqAndRound("t", "r", 2)).thenReturn(List.of(
        new Quote("q1", "t", "r", "s1", BigDecimal.TEN, BigDecimal.ONE, 1, "已提交", OffsetDateTime.now()),
        new Quote("q2", "t", "r", "s2", BigDecimal.ONE, BigDecimal.ONE, 1, "已提交", OffsetDateTime.now())));
    var response = quoteService().listSupplierRfqs().getFirst();
    assertThat(response.quotes()).extracting(QuoteResponse::id).containsExactly("q1");
    assertThat(response.invitedSupplierIds()).containsExactly("s1");
    assertThat(response.auctionMyRank()).isEqualTo(2);
  }

  @Test void buyerQuoteListAndStreamDenyMixedDepartmentRecordAndUnknownTenantRecord() {
    TenantContext.set("t", null, "u");
    when(scopes.currentUserDataScope()).thenReturn(DataScope.departments(List.of("own")));
    when(scopes.userDataScope("t", "u")).thenReturn(DataScope.departments(List.of("own")));
    var project = rfq("竞价", "报价中", null);
    when(rfqs.listByTenantFiltered(any(), any(), any(), any(), any())).thenReturn(List.of(project));
    when(rfqs.findByTenantAndId("t", "r")).thenReturn(project);
    when(demands.listDemandAccess("t", "r")).thenReturn(List.of(
        new RfqDemandMapper.DemandAccess("d1", "own", "u"),
        new RfqDemandMapper.DemandAccess("d2", "other", "v")));
    assertThat(service.listCurrentTenantRfqs()).isEmpty();
    assertThat(service.currentReadFilter().test("r")).isFalse();
    assertThat(service.currentReadFilter().test("foreign")).isFalse();
    verifyNoInteractions(quotes);
    verify(rfqs, never()).lockByTenantAndId(any(), any());
  }

  @Test void quoteAmountEqualsSumOfRoundedPersistedLinesAndProjectLockPrecedesLowestPrice() {
    TenantContext.set(null, "s1", "supplier-user");
    var project = rfq("竞价", "报价中", null);
    when(rfqs.findBySupplierInvite("r", "s1")).thenReturn(project);
    when(invites.isSupplierInvited("t", "r", "s1")).thenReturn(1);
    when(quotes.findByTenantAndId(eq("t"), any())).thenReturn(new Quote("q", "t", "r", "s1",
        new BigDecimal("0.02"), BigDecimal.ONE, 1, QuoteStatus.SUBMITTED, OffsetDateTime.now()));
    var line = new QuoteLineItemRequest("line", "项", new BigDecimal("0.50"), new BigDecimal("0.01"), null);
    quoteService().submit("r", new SubmitQuoteRequest(new BigDecimal("99"), BigDecimal.ONE, 1, List.of(line, line)));
    verify(quotes).insert(any(), eq("t"), eq("r"), eq("s1"), eq(new BigDecimal("0.02")), any(), any(), any(), eq(2));
    verify(lines, times(2)).insert(any(), eq("t"), any(), eq("line"), eq("项"), any(), any(),
        eq(new BigDecimal("0.01")), anyInt(), isNull());
    var order = inOrder(rfqs, quotes);
    order.verify(rfqs).findBySupplierInvite("r", "s1");
    order.verify(rfqs).lockByTenantAndId("t", "r");
    order.verify(rfqs).findBySupplierInvite("r", "s1");
    order.verify(quotes).countSubmittedBySupplier("t", "r", "s1", 2);
    order.verify(quotes).findLowestSubmittedAmount("t", "r", 2);
  }
}
