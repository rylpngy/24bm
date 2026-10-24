package com.procurement.order.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import java.time.LocalDate;
import java.util.List;
import jakarta.validation.Valid;

public record CreateDeliveryRequest(
    @NotBlank String carrier,
    @NotBlank String trackingNo,
    @Positive Integer shippedQuantity,
    LocalDate shippedDate,
    LocalDate estimatedArrival,
    String logisticsNote,
    @Valid List<DeliveryLineItemRequest> lineItems) {
  public CreateDeliveryRequest(String carrier, String trackingNo, Integer shippedQuantity,
      LocalDate shippedDate, LocalDate estimatedArrival, String logisticsNote) {
    this(carrier, trackingNo, shippedQuantity, shippedDate, estimatedArrival, logisticsNote, null);
  }
}
