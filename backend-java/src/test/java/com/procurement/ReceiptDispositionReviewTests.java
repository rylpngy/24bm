package com.procurement;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.identity.application.PermissionService;
import com.procurement.order.api.CreateReceiptDispositionReviewRequest;
import com.procurement.order.application.*;
import com.procurement.order.domain.*;
import com.procurement.order.infrastructure.*;
import com.procurement.tenant.application.TenantFeatureApplicationService;
import java.math.BigDecimal;
import java.time.*;
import org.junit.jupiter.api.*;

class ReceiptDispositionReviewTests {
  final OrderAccessService access = mock(OrderAccessService.class);
  final PermissionService permissions = mock(PermissionService.class);
  final PurchaseOrderMapper orders = mock(PurchaseOrderMapper.class);
  final ReceiptMapper receipts = mock(ReceiptMapper.class);
  final ReceiptDispositionReviewMapper reviews = mock(ReceiptDispositionReviewMapper.class);
  final AuditLogApplicationService audit = mock(AuditLogApplicationService.class);
  final TenantFeatureApplicationService features = mock(TenantFeatureApplicationService.class);
  final ReceiptDispositionReviewApplicationService service = new ReceiptDispositionReviewApplicationService(
      access, permissions, orders, receipts, reviews, audit, features);
  final OffsetDateTime time = OffsetDateTime.parse("2026-10-24T10:00:00Z");
  final CreateReceiptDispositionReviewRequest request = new CreateReceiptDispositionReviewRequest("让步接收", "技术复核可用", "QA-001");

  Receipt receipt(String disposition, int received, int qualified) {
    return new Receipt("r", "t", "o", "buyer", "部分合格", time, received, qualified, "缺陷保留", "部分合格", disposition, "原记录");
  }
  ReceiptDispositionReview review(String decision) {
    return new ReceiptDispositionReview("review", "t", "r", decision, "技术复核可用", "QA-001", "reviewer", time);
  }
  @BeforeEach void setup() {
    TenantContext.set("t", null, "reviewer");
    var order = new PurchaseOrder("o", "t", "rfq", "supplier", BigDecimal.TEN, "已收货", LocalDate.now(), time, time, "", "", "", "");
    when(orders.findByTenantAndId("t", "o")).thenReturn(order);
    when(orders.lockByTenantAndId("t", "o")).thenReturn(order);
    when(receipts.findByTenantAndId("t", "r")).thenReturn(receipt("退货换货", 10, 8));
    when(reviews.lockRfq("t", "rfq")).thenReturn("rfq");
    when(reviews.lockReceipt("t", "r")).thenReturn(receipt("退货换货", 10, 8));
  }
  @AfterEach void clear() { TenantContext.clear(); }

  @Test void appendsExplicitReviewWithDualPermissionsAndLocksWithoutChangingInspection() {
    when(reviews.find("t", "r")).thenReturn(null, review("让步接收"));
    assertThat(service.create("r", request).decision()).isEqualTo("让步接收");
    verify(access).requireOrder("o", "buyer:receipt:manage");
    verify(permissions).require("buyer:workflow:review");
    var sequence = inOrder(reviews, orders);
    sequence.verify(reviews).lockRfq("t", "rfq");
    sequence.verify(orders).lockByTenantAndId("t", "o");
    sequence.verify(reviews).lockReceipt("t", "r");
    sequence.verify(reviews).lockInvoices("t", "o");
    sequence.verify(reviews).lockContracts("t", "o");
    verify(reviews).insert(any(ReceiptDispositionReview.class));
    verify(audit).recordTenantAction("receipt.disposition_reviewed", "receipt", "r");
    verify(receipts, never()).insert(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
  }

  @Test void missingEitherPermissionOrScopeCannotWrite() {
    doThrow(new org.springframework.security.access.AccessDeniedException("denied")).when(access).requireOrder("o", "buyer:receipt:manage");
    assertThatThrownBy(() -> service.create("r", request)).isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
    verify(reviews, never()).insert(any());
    reset(access);
    doThrow(new org.springframework.security.access.AccessDeniedException("denied")).when(permissions).require("buyer:workflow:review");
    assertThatThrownBy(() -> service.create("r", request)).isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
    verify(reviews, never()).insert(any());
  }

  @Test void identicalRetryReturnsOriginalEvenAfterSettlementButConflictingContentCannotOverwrite() {
    when(reviews.find("t", "r")).thenReturn(review("让步接收"));
    when(reviews.countFrozenEvidence("t", "o", "rfq")).thenReturn(1);
    assertThat(service.create("r", request).reviewedBy()).isEqualTo("reviewer");
    assertThatThrownBy(() -> service.create("r", new CreateReceiptDispositionReviewRequest("维持退货换货", "仍不接受", "QA-002")))
        .isInstanceOf(IllegalStateException.class);
    verify(reviews, never()).insert(any());
  }

  @Test void settledOrArchivedOrdersAndNonnegativeOrAlreadyConcededReceiptsCannotBeChanged() {
    when(reviews.countFrozenEvidence("t", "o", "rfq")).thenReturn(1);
    assertThatThrownBy(() -> service.create("r", request)).isInstanceOf(IllegalStateException.class);
    when(reviews.countFrozenEvidence("t", "o", "rfq")).thenReturn(0);
    when(reviews.lockReceipt("t", "r")).thenReturn(receipt("退货换货", 10, 10));
    assertThatThrownBy(() -> service.create("r", request)).isInstanceOf(IllegalArgumentException.class);
    when(reviews.lockReceipt("t", "r")).thenReturn(receipt("让步接收", 10, 8));
    assertThatThrownBy(() -> service.create("r", request)).isInstanceOf(IllegalArgumentException.class);
    verify(reviews, never()).insert(any());
  }

  @Test void rejectingReviewRemainsExplicitAndReasonAndEvidenceAreMandatory() {
    for (var invalid : new CreateReceiptDispositionReviewRequest[] {
        new CreateReceiptDispositionReviewRequest("自动通过", "原因", "凭证"),
        new CreateReceiptDispositionReviewRequest("让步接收", " ", "凭证"),
        new CreateReceiptDispositionReviewRequest("让步接收", "原因", " ")}) {
      assertThatThrownBy(() -> service.create("r", invalid)).isInstanceOf(IllegalArgumentException.class);
    }
    when(reviews.find("t", "r")).thenReturn(null, review("维持退货换货"));
    assertThat(service.create("r", new CreateReceiptDispositionReviewRequest("维持退货换货", "仍不接受", "QA-002")).decision())
        .isEqualTo("维持退货换货");
  }

  @Test void getRequiresReceiptReadScopeAndNeverLeaksOtherTenants() {
    when(reviews.find("t", "r")).thenReturn(review("让步接收"));
    assertThat(service.get("r").evidenceNo()).isEqualTo("QA-001");
    verify(access).requireOrder("o", "buyer:receipt:read");
    TenantContext.set("another", null, "reviewer");
    assertThatThrownBy(() -> service.get("r")).isInstanceOf(IllegalArgumentException.class);
  }
}
