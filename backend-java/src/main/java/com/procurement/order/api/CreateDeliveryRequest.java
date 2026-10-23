package com.procurement.order.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import java.time.LocalDate;

public record CreateDeliveryRequest(
    @NotBlank String carrier,
    @NotBlank String trackingNo,
    @Positive Integer shippedQuantity,
    LocalDate shippedDate,
    LocalDate estimatedArrival,
    String logisticsNote) {
}
