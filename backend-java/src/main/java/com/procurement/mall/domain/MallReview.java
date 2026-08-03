package com.procurement.mall.domain;

import java.time.OffsetDateTime;

/** 订单行评价(M-4):一条订单行只能评一次,库上有唯一约束兜底。 */
public record MallReview(
    String id,
    String tenantId,
    String orderId,
    String orderLineId,
    String productId,
    String supplierId,
    int rating,
    String content,
    OffsetDateTime createdAt) {
}
