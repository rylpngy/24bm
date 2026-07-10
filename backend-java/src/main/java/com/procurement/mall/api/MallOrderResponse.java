package com.procurement.mall.api;

import java.math.BigDecimal;

public record MallOrderResponse(
    String orderId,
    String rfqId,
    String listingId,
    String supplierId,
    String materialName,
    BigDecimal quantity,
    BigDecimal amount) {
}
