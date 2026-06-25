package com.procurement.contract.api;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record ContractPaymentMilestoneResponse(
    String id,
    String name,
    int percent,
    BigDecimal amount,
    String status,
    OffsetDateTime paidAt) {
}
