package com.procurement.sourcing.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.util.List;

public record UpdateQuoteRequest(
    @Positive BigDecimal amount,
    @Positive BigDecimal taxRate,
    @Positive Integer deliveryDays,
    @Valid List<QuoteLineItemRequest> lineItems) {
}
