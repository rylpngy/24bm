package com.procurement.contract.domain;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record ContractPaymentMilestone(
    String id,
    String tenantId,
    String contractId,
    String name,
    int percent,
    BigDecimal amount,
    String status,
    int sortNo,
    OffsetDateTime paidAt) {
}
