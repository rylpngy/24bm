package com.procurement.mall.api;

import jakarta.validation.constraints.NotBlank;

/** 供应商处理售后(M-4):处理中 / 已完成 / 已拒绝;拒绝必须说明理由。 */
public record HandleAfterSalesRequest(@NotBlank String status, String reply) {
}
