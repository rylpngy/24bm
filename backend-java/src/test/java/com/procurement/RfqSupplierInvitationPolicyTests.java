package com.procurement;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.procurement.sourcing.domain.RfqSupplierInvitationPolicy;
import org.junit.jupiter.api.Test;

class RfqSupplierInvitationPolicyTests {
  @Test
  void allowsInvitingAdmittedSupplierToRfq() {
    assertThatCode(() -> RfqSupplierInvitationPolicy.requireAdmittedSupplier(1, "supplier-1"))
        .doesNotThrowAnyException();
  }

  @Test
  void rejectsInvitingSupplierWithoutAdmittedRelation() {
    assertThatThrownBy(() -> RfqSupplierInvitationPolicy.requireAdmittedSupplier(0, "supplier-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Supplier is not approved for tenant RFQ: supplier-1");
  }
}
