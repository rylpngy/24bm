package com.procurement.mall.api;

import jakarta.validation.constraints.NotBlank;

/** 商品状态流转:草稿 / 待审核 / 在架 / 下架。 */
public record UpdateMallProductStatusRequest(@NotBlank String status) {
}
