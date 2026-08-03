package com.procurement.mall.api;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

/** 订单行评价(M-4):收货后可评,一行一次。 */
public record CreateMallReviewRequest(
    @NotBlank String orderId,
    @NotBlank String orderLineId,
    String productId,
    @Min(1) @Max(5) int rating,
    String content) {
}
