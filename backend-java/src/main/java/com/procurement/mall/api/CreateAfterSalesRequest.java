package com.procurement.mall.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

/** 申请售后(M-4):按订单行提出,类型限 退货/换货/维修。 */
public record CreateAfterSalesRequest(
    @NotBlank String orderId,
    @NotBlank String orderLineId,
    @NotBlank String type,
    @NotNull BigDecimal quantity,
    @NotBlank String reason) {
}
