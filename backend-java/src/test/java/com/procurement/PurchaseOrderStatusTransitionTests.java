package com.procurement;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.procurement.order.domain.PurchaseOrderStatus;
import com.procurement.order.domain.PurchaseOrderStatusTransition;
import org.junit.jupiter.api.Test;

class PurchaseOrderStatusTransitionTests {

  private final PurchaseOrderStatusTransition transition = new PurchaseOrderStatusTransition();

  @Test
  void allowsSupplierConfirmationOnlyFromPendingConfirmation() {
    assertThatCode(() -> transition.requireSupplierConfirmation(
        PurchaseOrderStatus.PENDING_SUPPLIER_CONFIRMATION,
        "po-1"))
        .doesNotThrowAnyException();

    assertThatThrownBy(() -> transition.requireSupplierConfirmation(
        PurchaseOrderStatus.PENDING_SHIPMENT,
        "po-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Only pending supplier confirmation orders can be confirmed: po-1");
  }

  @Test
  void allowsShipmentOnlyFromPendingShipment() {
    assertThatCode(() -> transition.requireShipment(
        PurchaseOrderStatus.PENDING_SHIPMENT,
        "po-1"))
        .doesNotThrowAnyException();

    assertThatThrownBy(() -> transition.requireShipment(
        PurchaseOrderStatus.PENDING_SUPPLIER_CONFIRMATION,
        "po-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Only ready-to-ship orders can be shipped: po-1");
  }

  @Test
  void allowsReceiptOnlyFromShipped() {
    assertThatCode(() -> transition.requireReceipt(
        PurchaseOrderStatus.SHIPPED,
        "po-1"))
        .doesNotThrowAnyException();

    assertThatThrownBy(() -> transition.requireReceipt(
        PurchaseOrderStatus.RECEIVED,
        "po-1"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Only shipped purchase orders can be received: po-1");
  }
}
