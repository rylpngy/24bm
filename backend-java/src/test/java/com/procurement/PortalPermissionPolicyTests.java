package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import com.procurement.identity.security.PortalPermissionPolicy;
import org.junit.jupiter.api.Test;

class PortalPermissionPolicyTests {
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
    assertThat(required("buyer", "POST", "suppliers/s/exit")).isEqualTo("buyer:supplier:manage");
    assertThat(required("buyer", "POST", "supplier-invitations/import")).isEqualTo("buyer:supplier:manage");
  }
  @Test
  void readsDoNotGrantMutations() {
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
