package com.procurement.ludongpoc.api;

import java.math.BigDecimal;

public record LudongPocStatsResponse(
    long total,
    long drafts,
    long inApproval,
    long approved,
    long archived,
    BigDecimal totalBudget) {
}
