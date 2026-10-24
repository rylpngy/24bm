package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import com.procurement.identity.security.PortalPermissionPolicy;
import org.junit.jupiter.api.Test;

class PortalPermissionPolicyTests {
  @Test
  void mallCheckoutNotesRequireOrderReadRatherThanCatalogReadOrPurchase() {
    for (String scope : java.util.List.of("buyer", "supplier")) {
      assertThat(required(scope, "GET", "mall/orders/o/checkout-note")).isEqualTo(scope + ":order:read");
      assertThat(required(scope, "HEAD", "mall/orders/o/checkout-note")).isEqualTo(scope + ":order:read");
      for (String method : java.util.List.of("POST", "PUT", "PATCH", "DELETE")) {
        assertThat(required(scope, method, "mall/orders/o/checkout-note")).isEqualTo(scope + ":*");
      }
    }
    assertThat(required("buyer", "GET", "mall/products")).isEqualTo("buyer:mall:read");
    assertThat(required("supplier", "GET", "mall/products")).isEqualTo("supplier:mall:read");
    assertThat(required("buyer", "POST", "mall/orders")).isEqualTo("buyer:mall:purchase");
    assertThat(required("buyer", "POST", "mall/orders/batch")).isEqualTo("buyer:mall:purchase");
    assertThat(required("buyer", "POST", "mall/cart/checkout")).isEqualTo("buyer:mall:purchase");
  }

  @Test
  void rfqReadsAndAuctionStreamUseReadPermissionWithoutGrantingMutations() {
    for (String route : java.util.List.of("rfqs", "auction-stream", "rfqs/r/evaluation", "rfqs/r/result",
        "rfqs/r/supplier-performance", "rfqs/r/notice", "rfqs/r/notice/verify", "rfqs/r/notice.pdf",
        "rfqs/r/announcements", "rfqs/r/enrollments", "rfqs/r/clarifications", "rfqs/r/execution",
        "rfqs/r/execution/archives/a/download")) {
      assertThat(required("buyer", "GET", route)).as(route).isEqualTo("buyer:rfq:read");
      assertThat(required("buyer", "HEAD", route)).as(route).isEqualTo("buyer:rfq:read");
    }
  }

  @Test
  void rfqManagementAndApprovalEndpointsHaveDistinctPermissions() {
    for (String route : java.util.List.of("rfqs", "rfqs/r/open", "rfqs/r/publish", "rfqs/r/remind",
        "rfqs/r/abort", "rfqs/r/new-round", "rfqs/r/award", "rfqs/r/notice/issue",
        "rfqs/r/result/announce", "rfqs/r/clarifications/bulletin", "rfqs/r/clarifications/c/answer",
        "rfqs/r/enrollments/e/accept", "rfqs/r/enrollments/e/dismiss", "rfqs/r/execution/archives")) {
      assertThat(required("buyer", "POST", route)).as(route).isEqualTo("buyer:rfq:manage");
    }
    assertThat(required("buyer", "PUT", "rfqs/r")).isEqualTo("buyer:rfq:manage");
    assertThat(required("buyer", "PUT", "rfqs/r/invitations")).isEqualTo("buyer:rfq:manage");
    assertThat(required("buyer", "POST", "rfqs/r/award/approval")).isEqualTo("buyer:workflow:review");
  }

  @Test
  void unknownRfqRoutesAndUnsupportedMethodsStillFailClosed() {
    assertThat(required("buyer", "POST", "auction-stream")).isEqualTo("buyer:*");
    assertThat(required("buyer", "GET", "auction-stream/other")).isEqualTo("buyer:*");
    assertThat(required("buyer", "GET", "rfqs/r/unknown")).isEqualTo("buyer:*");
    assertThat(required("buyer", "POST", "rfqs/r/unknown")).isEqualTo("buyer:*");
    assertThat(required("buyer", "DELETE", "rfqs/r")).isEqualTo("buyer:*");
    assertThat(required("buyer", "GET", "rfqs/r/award/approval")).isEqualTo("buyer:*");
    assertThat(required("buyer", "PUT", "rfqs/r/award/approval")).isEqualTo("buyer:*");
  }

  @Test
  void buyerFulfillmentAndAdmissionActionsDoNotInheritUnrelatedWritePermissions() {
    assertThat(required("buyer", "GET", "orders")).isEqualTo("buyer:order:read");
    assertThat(required("buyer", "PUT", "orders/o")).isEqualTo("buyer:order:manage");
    assertThat(required("buyer", "POST", "orders/o/receipts")).isEqualTo("buyer:receipt:manage");
    assertThat(required("buyer", "GET", "receipts")).isEqualTo("buyer:receipt:read");
    assertThat(required("buyer", "GET", "suppliers/s/qualifications/q/download")).isEqualTo("buyer:supplier:read");
    assertThat(required("buyer", "POST", "suppliers/s/submit")).isEqualTo("buyer:supplier:manage");
    assertThat(required("buyer", "POST", "suppliers/s/approval")).isEqualTo("buyer:workflow:review");
    assertThat(required("buyer", "POST", "suppliers/qualification-reviews/1/review")).isEqualTo("buyer:workflow:review");
    assertThat(required("buyer", "GET", "suppliers/qualification-reviews")).isEqualTo("buyer:supplier:read");
    assertThat(required("buyer", "GET", "suppliers/s/exit-risk")).isEqualTo("buyer:supplier:manage");
    assertThat(required("buyer", "GET", "suppliers/s/exit-items")).isEqualTo("buyer:supplier:read");
    assertThat(required("buyer", "GET", "suppliers/s/fulfillment-metrics")).isEqualTo("buyer:supplier:read");
    assertThat(required("buyer", "GET", "suppliers/performance-comparison")).isEqualTo("buyer:supplier:read");
    assertThat(required("buyer", "POST", "suppliers/s/exit")).isEqualTo("buyer:supplier:manage");
    assertThat(required("buyer", "POST", "supplier-invitations/import")).isEqualTo("buyer:supplier:manage");
  }
  @Test
  void readsDoNotGrantMutations() {
    assertThat(required("supplier", "GET", "cooperation-invitations")).isEqualTo("supplier:profile:read");
    assertThat(required("supplier", "POST", "cooperation-invitations/i/respond")).isEqualTo("supplier:profile:manage");
    assertThat(required("supplier", "GET", "orders")).isEqualTo("supplier:order:read");
    assertThat(required("supplier", "POST", "orders/one/confirm")).isEqualTo("supplier:order:manage");
    assertThat(required("platform", "POST", "announcements")).isEqualTo("platform:announcement:manage");
    assertThat(required("platform", "HEAD", "announcements")).isEqualTo("platform:announcement:read");
  }

  @Test
  void nestedFinanceAndDeliveryRoutesHaveSeparatePermissions() {
    assertThat(required("supplier", "POST", "orders/o/deliveries")).isEqualTo("supplier:delivery:manage");
    assertThat(required("supplier", "POST", "orders/o/invoices")).isEqualTo("supplier:invoice:manage");
    assertThat(required("platform", "POST", "tenants/t/billing-statements/b/pay")).isEqualTo("platform:billing:manage");
  }

  @Test
  void aggregateAndUnmappedRoutesFailClosedForRestrictedRoles() {
    assertThat(required("supplier", "GET", "workspace")).isEqualTo("supplier:*");
    assertThat(required("platform", "GET", "business-metrics")).isEqualTo("platform:*");
    assertThat(required("supplier", "GET", "new-module")).isEqualTo("supplier:*");
  }

  private String required(String scope, String method, String route) {
    return PortalPermissionPolicy.required(scope, method, "/api/v1/" + scope + "/" + route);
  }
}
