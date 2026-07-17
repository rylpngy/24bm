package com.procurement.tender.api;

import java.math.BigDecimal;

/**
 * 单份有效投标的评标汇总(实时计算不落库):
 * 综合评分法 综合得分 = 技术均分×50% + 商务均分×20% + 价格分×30%;
 * 最低评标价法 按报价升序排名(价格分仍供参考)。价格分 = 最低有效报价/本报价×100。
 */
public record TenderBidEvaluationSummary(
    String bidId,
    String supplierName,
    BigDecimal bidAmount,
    BigDecimal avgTechnicalScore,
    BigDecimal avgCommercialScore,
    BigDecimal priceScore,
    BigDecimal compositeScore,
    int rank,
    boolean recommended,
    // 最新有效报价:最近一次已答复的二次报价修订价,无则为原投标价;价格分与排名按此计算。
    BigDecimal effectiveAmount) {
}
