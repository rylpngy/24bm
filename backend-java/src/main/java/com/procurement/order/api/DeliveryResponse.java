package com.procurement.order.api;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

public record DeliveryResponse(
    String id,
    String tenantId,
    String orderId,
    String supplierId,
    String carrier,
    String trackingNo,
    String status,
    OffsetDateTime createdAt,
    Integer shippedQuantity,
    LocalDate shippedDate,
    LocalDate estimatedArrival,
    String logisticsNote,
    List<DeliveryLineItemRequest> lineItems) {
  public DeliveryResponse(String id, String tenantId, String orderId, String supplierId,
      String carrier, String trackingNo, String status, OffsetDateTime createdAt,
      Integer shippedQuantity, LocalDate shippedDate, LocalDate estimatedArrival, String logisticsNote) {
    this(id, tenantId, orderId, supplierId, carrier, trackingNo, status, createdAt,
        shippedQuantity, shippedDate, estimatedArrival, logisticsNote, List.of());
  }
}
