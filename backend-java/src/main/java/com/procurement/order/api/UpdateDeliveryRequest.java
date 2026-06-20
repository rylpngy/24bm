package com.procurement.order.api;

import jakarta.validation.constraints.NotBlank;

public record UpdateDeliveryRequest(
    @NotBlank String carrier,
    @NotBlank String trackingNo) {
}
