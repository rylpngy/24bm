package com.procurement.sourcing.api;

import java.math.BigDecimal;

// 报价供应商的历史绩效快照(供定标参考):最新一期绩效总分 + 建议分级。
public record RfqSupplierPerformanceResponse(
    String supplierId,
    BigDecimal totalScore,
    String tier,
    String period,
    boolean hasHistory) {
}
