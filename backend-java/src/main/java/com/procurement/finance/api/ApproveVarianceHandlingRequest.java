package com.procurement.finance.api;

import jakarta.validation.constraints.NotNull;

// 财务经理对超阈值差异处理的签核:approved=true 结案(已处理),false 退回(待处理)。
public record ApproveVarianceHandlingRequest(
    @NotNull Boolean approved,
    String comment) {
}
