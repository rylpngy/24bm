package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.identity.application.DataScopeService;
import com.procurement.identity.application.PermissionService;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.order.application.PurchaseOrderApplicationService;
import com.procurement.sourcing.application.RfqAnnouncementService;
import com.procurement.sourcing.application.RfqApplicationService;
import com.procurement.supplier.application.SupplierProfileApplicationService;
import com.procurement.tenant.application.TenantCapabilityApplicationService;
import com.procurement.tender.api.*;
import com.procurement.tender.application.TenderApplicationService;
import com.procurement.tender.domain.*;
import com.procurement.tender.infrastructure.*;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class TenderStageThreeTests {
  private final TenderMapper tenders = mock(TenderMapper.class);
  private final TenderAcquisitionMapper acquisitions = mock(TenderAcquisitionMapper.class);
  private final TenderBidMapper bids = mock(TenderBidMapper.class);
  private final TenderEvaluationMapper evaluations = mock(TenderEvaluationMapper.class);
  private final TenderInquiryMapper inquiries = mock(TenderInquiryMapper.class);
  private final TenderPrequalificationMapper qualifications = mock(TenderPrequalificationMapper.class);
  private final PermissionService permissions = mock(PermissionService.class);
  private final DataScopeService scopes = mock(DataScopeService.class);
  private final PurchaseOrderApplicationService orders = mock(PurchaseOrderApplicationService.class);
  private final RfqApplicationService rfqs = mock(RfqApplicationService.class);
  private final NotificationApplicationService notifications = mock(NotificationApplicationService.class);
  private final RfqAnnouncementService announcements = mock(RfqAnnouncementService.class);
  private final TenderApplicationService service = new TenderApplicationService(
      tenders, acquisitions, bids, evaluations, inquiries, qualifications,
      mock(SupplierProfileApplicationService.class), mock(AuditLogApplicationService.class),
      notifications, rfqs, orders, announcements,
      mock(TenantCapabilityApplicationService.class), permissions, scopes);
  private final OffsetDateTime now = OffsetDateTime.now();

  @BeforeEach
  void setup() {
    TenantContext.set("tenant-1", null, "user-1");
    when(acquisitions.listByTender("tenant-1", "t-1")).thenReturn(List.of(new TenderAcquisition(
        "a-1", "tenant-1", "t-1", "s-1", "邀请发放", now.minusDays(4), now.minusDays(4))));
  }

  @AfterEach
  void clear() { TenantContext.clear(); }

  private Tender tender(String status, String orderId, boolean prequalified) {
    return new Tender("t-1", "tenant-1", "ZB001", "Tender", "邀请招标", BigDecimal.TEN,
        status, "doc", "综合评分法", null, now.minusDays(3), now.minusDays(2), now.minusDays(1),
        "user-1", now.minusDays(4), now, now, now.minusDays(1),
        "已定标".equals(status) ? "b-1" : null, null, "notice", null, null, null, orderId, prequalified);
  }

  private TenderBid bid(String digest) throws Exception {
    String actual = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(
        "tender-bid|tender:t-1|supplier:s-1|amount:10|doc:bid".getBytes(StandardCharsets.UTF_8)));
    return new TenderBid("b-1", "tenant-1", "t-1", "s-1", BigDecimal.TEN, "bid",
        digest == null ? actual : digest, "已开启", now.minusDays(2).minusHours(1), null);
  }

  private void current(Tender tender) {
    when(tenders.findByTenantAndId("tenant-1", "t-1")).thenReturn(tender);
    when(tenders.lockByTenantAndId("tenant-1", "t-1")).thenReturn(tender);
  }

  private void committee(boolean complete) {
    when(evaluations.listEvaluators("tenant-1", "t-1")).thenReturn(
        java.util.stream.IntStream.range(1, 4).mapToObj(i -> new TenderEvaluator(
            "e-" + i, "tenant-1", "t-1", "Member " + i, "成员", now)).toList());
    when(evaluations.listScores("tenant-1", "t-1")).thenReturn(
        java.util.stream.IntStream.range(1, complete ? 4 : 3).mapToObj(i -> new TenderScore(
            "score-" + i, "tenant-1", "t-1", "b-1", "e-" + i,
            BigDecimal.TEN, BigDecimal.TEN, "record", now)).toList());
  }

  @Test
  void awardRejectsIncompleteEvaluationWithoutPublishingResult() throws Exception {
    current(tender("评标中", null, false));
    when(bids.listByTender("tenant-1", "t-1")).thenReturn(List.of(bid(null)));
    committee(false);
    assertThatThrownBy(() -> service.awardTender("t-1", new AwardTenderRequest("b-1", "notice")))
        .hasMessageContaining("完整评分");
    verifyNoInteractions(announcements);
    verify(tenders, never()).markAwarded(any(), any(), any(), any(), any(), any());
  }

  @Test
  void awardRejectsTamperedOrUnqualifiedBid() throws Exception {
    current(tender("评标中", null, true));
    committee(true);
    when(bids.listByTender("tenant-1", "t-1")).thenReturn(List.of(bid("tampered")));
    assertThatThrownBy(() -> service.awardTender("t-1", new AwardTenderRequest("b-1", "notice")))
        .hasMessageContaining("有效投标");
    when(bids.listByTender("tenant-1", "t-1")).thenReturn(List.of(bid(null)));
    assertThatThrownBy(() -> service.awardTender("t-1", new AwardTenderRequest("b-1", "notice")))
        .hasMessageContaining("有效投标");
    verifyNoInteractions(announcements);
  }

  @Test
  void awardAcceptsCompleteValidBidAndNotifiesWinner() throws Exception {
    current(tender("评标中", null, false));
    committee(true);
    when(bids.listByTender("tenant-1", "t-1")).thenReturn(List.of(bid(null)));
    service.awardTender("t-1", new AwardTenderRequest("b-1", "notice"));
    verify(tenders).markAwarded(eq("tenant-1"), eq("t-1"), eq("已定标"), eq("b-1"), any(), eq("notice"));
    verify(notifications).notifyActiveSupplierUsers(eq("tenant-1"), eq("s-1"), anyString(), anyString());
  }

  @Test
  void executionReplayReturnsExistingOrderWithoutCreatingAnother() {
    current(tender("已定标", "po-existing", false));
    assertThat(service.executeTender("t-1", new ExecuteTenderRequest(LocalDate.now().plusDays(3)))
        .executionOrderId()).isEqualTo("po-existing");
    verifyNoInteractions(orders, rfqs);
    verify(tenders).lockByTenantAndId("tenant-1", "t-1");
  }

  @Test
  void executionLocksBeforeCallingUnifiedOrderServiceAndUsesRequote() throws Exception {
    current(tender("已定标", null, false));
    when(bids.listByTender("tenant-1", "t-1")).thenReturn(List.of(bid(null)));
    when(inquiries.listByTender("tenant-1", "t-1")).thenReturn(List.of(new TenderInquiry(
        "i-1", "tenant-1", "t-1", "b-1", "二次报价", "quote", now,
        "answer", new BigDecimal("8.00"), now)));
    when(rfqs.createTenderAnchor(anyString(), eq("s-1"))).thenReturn("rfq-anchor");
    when(orders.createTenderOrder(any(), any(), any(), any(), any())).thenReturn("po-1");
    when(tenders.markExecuted("tenant-1", "t-1", "po-1")).thenReturn(1);
    var date = LocalDate.now().plusDays(3);
    service.executeTender("t-1", new ExecuteTenderRequest(date));
    var sequence = inOrder(tenders, rfqs, orders);
    sequence.verify(tenders).lockByTenantAndId("tenant-1", "t-1");
    sequence.verify(rfqs).createTenderAnchor(anyString(), eq("s-1"));
    sequence.verify(orders).createTenderOrder(eq("rfq-anchor"), eq("s-1"), eq(new BigDecimal("8.00")), eq(date), anyString());
    sequence.verify(tenders).markExecuted("tenant-1", "t-1", "po-1");
  }

  @Test
  void invitedAcquisitionCannotBypassDeadline() {
    var tender = tender("发售中", null, false);
    TenantContext.set(null, "s-1", "supplier-user");
    current(tender);
    when(acquisitions.listTendersBySupplier("s-1")).thenReturn(List.of(tender));
    when(acquisitions.listBySupplier("s-1")).thenReturn(List.of(new TenderAcquisition(
        "a-1", "tenant-1", "t-1", "s-1", "邀请发放", null, now)));
    assertThatThrownBy(() -> service.acquire("t-1")).hasMessageContaining("已截止");
    verify(acquisitions, never()).markAcquired(any(), any(), any(), any());
  }

  @Test
  void tenantAndCreatorScopeAreCheckedBeforeMutation() {
    current(tender("评标中", null, false));
    doThrow(new IllegalStateException("creator scope denied")).when(scopes).requireCreatorAccess("user-1");
    assertThatThrownBy(() -> service.awardTender("t-1", new AwardTenderRequest("b-1", "notice")))
        .hasMessageContaining("scope denied");
    verifyNoInteractions(bids, orders, announcements);
  }

  @Test
  void supplierReadOnlyPermissionCannotWrite() {
    TenantContext.set(null, "s-1", "supplier-user");
    doThrow(new IllegalStateException("supplier read only")).when(permissions).require("supplier:tender:manage");
    assertThatThrownBy(() -> service.acquire("t-1")).hasMessageContaining("read only");
    verify(tenders, never()).lockByTenantAndId(any(), any());
  }

  @Test
  void invitedDistributionRejectsSupplierOutsideCurrentTenantAdmission() {
    Tender onSale = new Tender("t-1", "tenant-1", "ZB001", "Tender", "邀请招标", BigDecimal.TEN,
        "发售中", "doc", "综合评分法", null, now.plusDays(1), now.plusDays(2), now.plusDays(3),
        "user-1", now, now, now, null, null, null, null, null, null, null, null, false);
    current(onSale);
    assertThatThrownBy(() -> service.distribute("t-1", new DistributeTenderRequest(List.of("other-tenant-supplier"))))
        .hasMessageContaining("本企业已准入供应商");
    verify(acquisitions, never()).insertIgnore(any(), any(), any(), any(), any(), any());
  }

  @Test
  void pendingInquiryBlocksAwardEvenWithAllScores() throws Exception {
    current(tender("评标中", null, false));
    committee(true);
    when(bids.listByTender("tenant-1", "t-1")).thenReturn(List.of(bid(null)));
    when(inquiries.listByTender("tenant-1", "t-1")).thenReturn(List.of(new TenderInquiry(
        "i-1", "tenant-1", "t-1", "b-1", "二次报价", "quote", now, null, null, null)));
    assertThatThrownBy(() -> service.awardTender("t-1", new AwardTenderRequest("b-1", "notice")))
        .hasMessageContaining("问询答复");
    verifyNoInteractions(announcements);
  }

  @Test
  void rebidReplayReturnsExistingSuccessorWithoutCreatingAnother() {
    current(tender("已流标", null, true));
    when(tenders.findRebid("tenant-1", "t-1")).thenReturn(tender("编制中", null, true));
    assertThat(service.rebidTender("t-1").prequalificationRequired()).isTrue();
    verify(tenders, never()).lockTenantNumbering(any());
    verify(tenders, never()).markRebidOf(any(), any(), any());
  }

  @Test
  void mixedValidityExposesEligibilityAndCountsOnlyEligibleScores() throws Exception {
    Tender evaluating = tender("评标中", null, true);
    current(evaluating);
    when(tenders.listVisibleByTenant(eq("tenant-1"), any())).thenReturn(List.of(evaluating));
    committee(true);
    TenderBid valid = bid(null);
    TenderBid tampered = evaluationBid("tampered", "s-2", now.minusDays(3), "wrong");
    TenderBid late = evaluationBid("late", "s-3", now, null);
    TenderBid unqualified = evaluationBid("unqualified", "s-4", now.minusDays(3), null);
    var mixed = List.of(valid, tampered, late, unqualified);
    when(bids.listByTender("tenant-1", "t-1")).thenReturn(mixed);
    when(acquisitions.listByTender("tenant-1", "t-1")).thenReturn(mixed.stream().map(b ->
        new TenderAcquisition("a-" + b.id(), "tenant-1", "t-1", b.supplierId(), "邀请发放",
            now.minusDays(4), now.minusDays(4))).toList());
    when(qualifications.listByTender("tenant-1", "t-1")).thenReturn(List.of("s-1", "s-2", "s-3").stream()
        .map(s -> new TenderPrequalification("q-" + s, "tenant-1", "t-1", s, "application",
            "已通过", "passed", now.minusDays(5), now.minusDays(4))).toList());
    var scores = new java.util.ArrayList<TenderScore>();
    for (int i = 1; i <= 3; i++) {
      for (TenderBid b : mixed) {
        scores.add(new TenderScore("score-" + i + b.id(), "tenant-1", "t-1", b.id(), "e-" + i,
            BigDecimal.TEN, BigDecimal.TEN, "history", now));
      }
    }
    when(evaluations.listScores("tenant-1", "t-1")).thenReturn(scores);
    TenderResponse response = service.listCurrentTenantTenders().getFirst();
    assertThat(response.bids()).filteredOn(b -> Boolean.TRUE.equals(b.evaluationEligible()))
        .extracting(TenderBidResponse::id).containsExactly("b-1");
    assertThat(response.bids()).filteredOn(b -> !b.id().equals("b-1"))
        .allSatisfy(b -> assertThat(b.evaluationEligible()).isFalse());
    assertThat(response.evaluators()).allSatisfy(e -> assertThat(e.scoredCount()).isEqualTo(1));
    assertThat(response.evaluationSummary()).extracting(TenderBidEvaluationSummary::bidId).containsExactly("b-1");
    assertThat(response.evaluationSummary().getFirst().recommended()).isTrue();

    scores.removeIf(s -> s.evaluatorId().equals("e-3") && s.bidId().equals("b-1"));
    TenderResponse incomplete = service.listCurrentTenantTenders().getFirst();
    assertThat(incomplete.evaluators()).filteredOn(e -> e.id().equals("e-3"))
        .allSatisfy(e -> assertThat(e.scoredCount()).isZero());
    assertThat(incomplete.evaluationSummary().getFirst().recommended()).isFalse();

    service.submitScores("t-1", new SubmitScoresRequest("e-1", List.of(
        new SubmitScoresRequest.Line("b-1", BigDecimal.TEN, BigDecimal.TEN, "valid only"))));
    verify(evaluations).upsertScore(any(), eq("tenant-1"), eq("t-1"), eq("b-1"), eq("e-1"), any(), any(), any(), any());
  }

  private TenderBid evaluationBid(String id, String supplier, OffsetDateTime submitted, String digest) throws Exception {
    String payload = "tender-bid|tender:t-1|supplier:" + supplier + "|amount:10|doc:bid";
    String actual = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(payload.getBytes(StandardCharsets.UTF_8)));
    return new TenderBid(id, "tenant-1", "t-1", supplier, BigDecimal.TEN, "bid",
        digest == null ? actual : digest, "已开启", submitted, null);
  }

  @Test
  void rejectsSubCentBidInsteadOfStoringRoundedAmountWithInvalidDigest() {
    assertThatThrownBy(() -> TenderBidPolicy.requireValidBid(new BigDecimal("10.001"), "bid", "t-1"))
        .hasMessageContaining("两位小数");
  }
}
