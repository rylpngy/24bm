package com.procurement;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.procurement.supplier.domain.BuyerSupplierPaymentPolicy;
import org.junit.jupiter.api.Test;

class BuyerSupplierPaymentPolicyTests {
  @Test
  void allowsPayingSupplierWithoutBlacklistedRelation() {
    assertThatCode(() -> BuyerSupplierPaymentPolicy.requirePayable(0, "supplier-1"))
        .doesNotThrowAnyException();
  }

  @Test
  void rejectsPaymentToBlacklistedSupplier() {
    assertThatThrownBy(() -> BuyerSupplierPaymentPolicy.requirePayable(1, "supplier-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Blacklisted supplier cannot be paid: supplier-1");
  }
}
