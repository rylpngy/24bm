package com.procurement.sourcing.api;

import jakarta.validation.constraints.NotBlank;

// kind: 流标(不足法定家数/无有效报价) / 废标(全部不合格、采购方取消)。
public record AbortRfqRequest(@NotBlank String kind, String reason) {
}
