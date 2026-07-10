package com.procurement.sourcing.api;

import java.util.List;

// 加权评标结果:按「价格/交期」权重对某 RFQ 的报价打分排名,并给出推荐定标对象。
public record BidEvaluationResponse(
    String rfqId,
    int priceWeight,
    int deliveryWeight,
    String recommendedQuoteId,
    String recommendedSupplierId,
    List<BidEvaluationRowResponse> rows) {
}
