package com.procurement.ludongpoc.api;

public record LudongPocAiReviewMetricsResponse(
    String datasetVersion,
    int fixedSampleCount,
    int expectedRiskCount,
    int detectedRiskCount,
    int truePositiveCount,
    int falsePositiveCount,
    double riskRecall,
    double riskPrecision,
    int humanFeedbackCount,
    int adoptedCount,
    int humanFalsePositiveCount,
    double adoptionRate) {
}
