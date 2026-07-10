package com.procurement.contract.api;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

// 合同变更时间线一条。
public record ContractAmendmentResponse(
    String id,
    String contractId,
    int seq,
    String changeType,
    BigDecimal oldAmount,
    BigDecimal newAmount,
    LocalDate oldExpiryDate,
    LocalDate newExpiryDate,
    String reason,
    String actorId,
    OffsetDateTime createdAt) {
}
