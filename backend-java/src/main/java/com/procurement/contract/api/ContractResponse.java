package com.procurement.contract.api;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

public record ContractResponse(
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
    OffsetDateTime updatedAt,
    LocalDate signDate,
    LocalDate expiryDate,
    String paymentTerms,
    String warrantyTerms,
    String renewalStatus) {
}
