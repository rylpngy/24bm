package com.procurement.mall.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/** 采购方审核商品上架(M-4):通过即上架,驳回退回草稿;两种结论都必须写意见。 */
public record ReviewMallProductRequest(@NotNull Boolean approved, @NotBlank String comment) {
}
