package com.procurement.sourcing.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;

// 供应商提交的单条报价行项。行金额由服务端按 quantity × unitPrice 计算。
// demandItemId 指向本项目采购清单行——供应商按清单报价,品名/单位/数量以清单为准。
public record QuoteLineItemRequest(
    @NotBlank String description,
    String unit,
    @Positive BigDecimal quantity,
    @Positive BigDecimal unitPrice,
    String demandItemId) {
}
