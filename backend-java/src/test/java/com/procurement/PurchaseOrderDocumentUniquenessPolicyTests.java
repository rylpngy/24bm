package com.procurement;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.procurement.order.domain.PurchaseOrderDocumentUniquenessPolicy;
import org.junit.jupiter.api.Test;

class PurchaseOrderDocumentUniquenessPolicyTests {
  @Test
  void allowsCreatingFirstDocumentForOrder() {
    assertThatCode(() -> PurchaseOrderDocumentUniquenessPolicy.requireNoDelivery(0, "po-1"))
        .doesNotThrowAnyException();
    assertThatCode(() -> PurchaseOrderDocumentUniquenessPolicy.requireNoReceipt(0, "po-1"))
        .doesNotThrowAnyException();
    assertThatCode(() -> PurchaseOrderDocumentUniquenessPolicy.requireNoInvoice(0, "po-1"))
        .doesNotThrowAnyException();
  }

  @Test
  void rejectsDuplicateDeliveryReceiptAndInvoiceForOrder() {
    assertThatThrownBy(() -> PurchaseOrderDocumentUniquenessPolicy.requireNoDelivery(1, "po-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Purchase order already has a delivery");
    assertThatThrownBy(() -> PurchaseOrderDocumentUniquenessPolicy.requireNoReceipt(1, "po-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Purchase order already has a receipt");
    assertThatThrownBy(() -> PurchaseOrderDocumentUniquenessPolicy.requireNoInvoice(1, "po-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Purchase order already has an invoice");
  }
}
