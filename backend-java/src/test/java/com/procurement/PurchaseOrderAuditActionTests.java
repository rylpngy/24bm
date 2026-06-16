package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import com.procurement.order.domain.PurchaseOrderAuditAction;
import org.junit.jupiter.api.Test;

class PurchaseOrderAuditActionTests {

  @Test
  void definesPurchaseOrderAuditActions() {
    assertThat(PurchaseOrderAuditAction.CREATED).isEqualTo("purchase_order.created");
    assertThat(PurchaseOrderAuditAction.CONFIRMED).isEqualTo("purchase_order.confirmed");
    assertThat(PurchaseOrderAuditAction.SHIPPED).isEqualTo("purchase_order.shipped");
    assertThat(PurchaseOrderAuditAction.RECEIVED).isEqualTo("purchase_order.received");
  }
}
