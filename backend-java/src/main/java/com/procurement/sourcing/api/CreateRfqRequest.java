package com.procurement.sourcing.api;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.time.OffsetDateTime;
import java.util.List;

public record CreateRfqRequest(
    @NotBlank String title,
    @NotEmpty List<String> demandIds,
    @NotEmpty List<String> invitedSupplierIds,
    @Future OffsetDateTime deadlineAt,
    String quoteRequirement,
    String deliveryRequirement,
    String evaluationMethod,
    String method,
    // 竞价专属:起拍价(竞价必填)与最小降价步长(可选,缺省 0)。
    java.math.BigDecimal auctionStartPrice,
    java.math.BigDecimal auctionMinDecrement,
    // 单一来源专属:来源说明(必填,审批留痕)。
    String singleSourceReason) {
}
