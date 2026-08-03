package com.procurement.mall.api;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/** 售后单(M-4)。 */
public record MallAfterSalesResponse(
    String id,
    String orderId,
    String orderLineId,
    String supplierId,
    String supplierName,
    String type,
    BigDecimal quantity,
    String reason,
    String status,
    String supplierReply,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {
}
