package com.procurement.order.api;

import java.math.BigDecimal;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record DeliveryLineItemRequest(
    @NotBlank String orderLineId, @NotNull @Positive BigDecimal shippedQuantity) {}
