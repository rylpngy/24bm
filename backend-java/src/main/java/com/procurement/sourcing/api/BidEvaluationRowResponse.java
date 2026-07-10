package com.procurement.sourcing.api;

import java.math.BigDecimal;

// 评标矩阵一行:某报价在「价格/交期」各维的得分与加权总分、名次。
public record BidEvaluationRowResponse(
    String quoteId,
    String supplierId,
    BigDecimal amount,
    Integer deliveryDays,
    BigDecimal taxRate,
    BigDecimal priceScore,
    BigDecimal deliveryScore,
    BigDecimal weightedScore,
    int rank,
    boolean recommended) {
}
