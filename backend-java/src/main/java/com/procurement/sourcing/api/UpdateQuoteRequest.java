package com.procurement.sourcing.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.util.List;

public record UpdateQuoteRequest(
    @Positive BigDecimal amount,
    @jakarta.validation.constraints.DecimalMin("0") @jakarta.validation.constraints.DecimalMax("100") BigDecimal taxRate,
    @Positive Integer deliveryDays,
    @Valid List<QuoteLineItemRequest> lineItems,
    @Valid QuotationDetails details,
    Integer expectedVersion) {
  public UpdateQuoteRequest(BigDecimal amount, BigDecimal taxRate, Integer deliveryDays, List<QuoteLineItemRequest> lineItems) {
    this(amount,taxRate,deliveryDays,lineItems,null,null);
  }
}
