package com.procurement.sourcing.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.util.List;

// lineItems 可选:提供时服务端按行汇总覆盖 amount(头/明细一致);为空时沿用 amount(兼容旧报价)。
public record SubmitQuoteRequest(
    @Positive BigDecimal amount,
    @Positive BigDecimal taxRate,
    @Positive Integer deliveryDays,
    @Valid List<QuoteLineItemRequest> lineItems) {
}
