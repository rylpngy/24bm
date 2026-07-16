package com.procurement.tender.api;

public record TenderEvaluatorResponse(
    String id,
    String evaluatorName,
    String evaluatorRole,
    // 该评委已完成评分的有效投标数(=有效投标总数即已交卷)。
    int scoredCount) {
}
