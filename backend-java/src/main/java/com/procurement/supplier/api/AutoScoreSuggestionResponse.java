package com.procurement.supplier.api;

import java.math.BigDecimal;

// 按实测履约数据生成的绩效评分建议:质量=合格率、交付=准时率,价格/服务取默认基准。
public record AutoScoreSuggestionResponse(
    BigDecimal qualityScore,
    BigDecimal deliveryScore,
    BigDecimal priceScore,
    BigDecimal serviceScore,
    BigDecimal totalScore,
    String suggestedTier,
    int receiptCount,
    boolean hasData,
    String basis) {
}
