package com.procurement;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.procurement.finance.domain.InvoiceCreationStatusPolicy;
import com.procurement.order.domain.PurchaseOrderStatus;
import org.junit.jupiter.api.Test;

class InvoiceCreationStatusPolicyTests {
  @Test
  void allowsInvoiceCreationForReceivedPurchaseOrder() {
    assertThatCode(() -> InvoiceCreationStatusPolicy.requireReceivedOrder(PurchaseOrderStatus.RECEIVED, "po-1"))
        .doesNotThrowAnyException();
  }

  @Test
  void rejectsInvoiceCreationForUnreceivedPurchaseOrder() {
    assertThatThrownBy(() -> InvoiceCreationStatusPolicy.requireReceivedOrder(PurchaseOrderStatus.SHIPPED, "po-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Only received purchase orders can be invoiced: po-1");
  }
}
