package com.procurement.mall.api;

import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;

/** 加购 / 改量(M-2):数量为 0 或负数即从购物车移除。 */
public record SaveMallCartItemRequest(@NotBlank String skuId, BigDecimal quantity) {
}
