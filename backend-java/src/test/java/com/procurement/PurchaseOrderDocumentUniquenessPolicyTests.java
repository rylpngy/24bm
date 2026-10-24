package com.procurement;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.procurement.order.domain.PurchaseOrderDocumentUniquenessPolicy;
import org.junit.jupiter.api.Test;

class PurchaseOrderDocumentUniquenessPolicyTests {
  @Test
  void allowsCreatingFirstDocumentForOrder() {
    assertThatCode(() -> PurchaseOrderDocumentUniquenessPolicy.requireNoInvoice(0, "po-1"))
        .doesNotThrowAnyException();
  }

  @Test
  void invoicesRemainUniqueWhileFulfillmentCapacityIsTestedSeparately() {
    assertThatThrownBy(() -> PurchaseOrderDocumentUniquenessPolicy.requireNoInvoice(1, "po-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Purchase order already has an invoice");
  }
}
