package com.procurement.sourcing.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

// 直录采购内容行:物料 + 数量(计划/询价节点直接创建时录入)。
public record DirectRfqItemRequest(@NotBlank String materialId, @Positive Integer quantity) {
}
