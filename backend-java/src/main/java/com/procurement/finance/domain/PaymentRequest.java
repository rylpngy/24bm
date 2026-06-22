package com.procurement.finance.domain;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record PaymentRequest(
    String id,
    String tenantId,
    String invoiceId,
    String supplierId,
    String orderId,
    BigDecimal amount,
    String requestStatus,
    String paymentBatchNo,
    String remark,
    String createdBy,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {
}
