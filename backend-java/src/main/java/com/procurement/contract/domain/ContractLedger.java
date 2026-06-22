package com.procurement.contract.domain;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

public record ContractLedger(
    String id,
    String tenantId,
    String contractNo,
    String contractName,
    String relatedOrderId,
    String supplierId,
    BigDecimal amount,
    String status,
    String archiveStatus,
    String fulfillmentProgress,
    LocalDate effectiveDate,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {
}
