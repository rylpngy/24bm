package com.procurement.order.domain;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;

public record PurchaseOrder(
    String id,
    String tenantId,
    String rfqId,
    String supplierId,
    BigDecimal amount,
    String status,
    LocalDate expectedReceiptDate,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt,
    String deliveryAddress,
    String contactName,
    String contactPhone,
    String paymentTerms) {
}
