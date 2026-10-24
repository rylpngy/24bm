package com.procurement;

import static org.mockito.Mockito.*;
import com.procurement.common.tenant.TenantContext;
import com.procurement.order.api.*;
import com.procurement.order.domain.*;
import com.procurement.order.infrastructure.*;
import java.math.BigDecimal;
import java.util.List;

final class TestOrderFulfillment {
  static void configure(PurchaseOrderMapper orders, DeliveryMapper deliveries) {
    when(orders.lockByTenantAndId("tenant-1", "po-1")).thenAnswer(invocation ->
        TenantContext.supplierId() != null ? orders.findBySupplierAndId("supplier-1", "po-1")
            : orders.findByTenantAndId("tenant-1", "po-1"));
    when(deliveries.fulfillmentLines("tenant-1", "po-1")).thenAnswer(invocation -> List.of(
        new OrderFulfillmentLine("oli-1", BigDecimal.valueOf(4),
            TenantContext.supplierId() == null ? BigDecimal.valueOf(4) : BigDecimal.ZERO,
            BigDecimal.ZERO, BigDecimal.ZERO)));
  }

  static OrderLineItemMapper orderLines() {
    var mapper = mock(OrderLineItemMapper.class);
    when(mapper.listByOrder("tenant-1", "po-1")).thenReturn(List.of(new OrderLineItem(
        "oli-1", "tenant-1", "po-1", "网络机柜", "台", BigDecimal.valueOf(4),
        BigDecimal.valueOf(12000), BigDecimal.valueOf(48000), 0)));
    return mapper;
  }

  static CreateDeliveryRequest shipment() {
    return new CreateDeliveryRequest("顺丰", "SF123", 4, null, null, null,
        List.of(new DeliveryLineItemRequest("oli-1", BigDecimal.valueOf(4))));
  }

  static CreateReceiptRequest receipt() {
    return new CreateReceiptRequest("验收通过", 4, 4, null,
        List.of(new ReceiptLineItemRequest("oli-1", BigDecimal.valueOf(4), BigDecimal.valueOf(4))), null, null);
  }
}
