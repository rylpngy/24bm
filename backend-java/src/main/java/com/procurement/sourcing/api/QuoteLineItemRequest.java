package com.procurement.sourcing.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;

// 供应商提交的单条报价行项。行金额由服务端按 quantity × unitPrice 计算。
public record QuoteLineItemRequest(
    @NotBlank String description,
    String unit,
    @Positive BigDecimal quantity,
    @Positive BigDecimal unitPrice) {
}
