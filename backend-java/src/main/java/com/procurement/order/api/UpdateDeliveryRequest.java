package com.procurement.order.api;

import jakarta.validation.constraints.NotBlank;
import java.time.LocalDate;

public record UpdateDeliveryRequest(
    @NotBlank String carrier,
    @NotBlank String trackingNo,
    Integer shippedQuantity,
    LocalDate shippedDate,
    LocalDate estimatedArrival,
    String logisticsNote) {
}
