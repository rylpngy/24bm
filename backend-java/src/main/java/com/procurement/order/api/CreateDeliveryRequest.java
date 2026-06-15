package com.procurement.order.api;

import jakarta.validation.constraints.NotBlank;

public record CreateDeliveryRequest(
    @NotBlank String carrier,
    @NotBlank String trackingNo) {
}
