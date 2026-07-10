package com.procurement.order.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;
import java.math.BigDecimal;

// 单条收货验收行项:针对某订单行项填写收货数量与合格数量。
public record ReceiptLineItemRequest(
    @NotBlank String orderLineId,
    @PositiveOrZero BigDecimal receivedQuantity,
    @PositiveOrZero BigDecimal qualifiedQuantity) {
}
