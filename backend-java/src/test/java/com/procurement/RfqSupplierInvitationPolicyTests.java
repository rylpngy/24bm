package com.procurement;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.procurement.sourcing.domain.RfqSupplierInvitationPolicy;
import java.util.List;
import org.junit.jupiter.api.Test;

class RfqSupplierInvitationPolicyTests {
  @Test
  void allowsInvitingAdmittedSupplierToRfq() {
    assertThatCode(() -> RfqSupplierInvitationPolicy.requireAdmittedSupplier(1, "supplier-1"))
        .doesNotThrowAnyException();
  }

  @Test
  void allowsInvitingSupplierWithActiveQualificationToRfq() {
    assertThatCode(() -> RfqSupplierInvitationPolicy.requireActiveQualification(1, "supplier-1"))
        .doesNotThrowAnyException();
  }

  @Test
  void rejectsInvitingSupplierWithoutAdmittedRelation() {
    assertThatThrownBy(() -> RfqSupplierInvitationPolicy.requireAdmittedSupplier(0, "supplier-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Supplier is not approved for tenant RFQ: supplier-1");
  }

  @Test
  void rejectsInvitingSupplierWithoutActiveQualification() {
    assertThatThrownBy(() -> RfqSupplierInvitationPolicy.requireActiveQualification(0, "supplier-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Supplier lacks active qualification for tenant RFQ: supplier-1");
  }

  @Test
  void rejectsEmptyOrDuplicatedRfqInviteSupplierList() {
    assertThatThrownBy(() -> RfqSupplierInvitationPolicy.requireValidInviteList(List.of()))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("RFQ requires at least one invited supplier");

    assertThatThrownBy(() -> RfqSupplierInvitationPolicy.requireValidInviteList(List.of("supplier-1", "supplier-1")))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("RFQ cannot invite the same supplier more than once: supplier-1");
  }
}
