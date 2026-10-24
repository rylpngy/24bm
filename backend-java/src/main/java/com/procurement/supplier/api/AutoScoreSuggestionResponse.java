package com.procurement.supplier.api;

import java.math.BigDecimal;

// Only observed quality/delivery scores are populated; price/service/total/tier remain null.
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
