package com.procurement.sourcing.api;

import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;

public record UpdateQuoteRequest(
    @Positive BigDecimal amount,
    @Positive BigDecimal taxRate,
    @Positive Integer deliveryDays) {
}
