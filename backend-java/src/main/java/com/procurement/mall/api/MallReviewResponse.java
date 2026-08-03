package com.procurement.mall.api;

import java.time.OffsetDateTime;

/** 订单行评价(M-4)。 */
public record MallReviewResponse(
    String id,
    String orderId,
    String orderLineId,
    String productId,
    String supplierId,
    int rating,
    String content,
    OffsetDateTime createdAt) {
}
