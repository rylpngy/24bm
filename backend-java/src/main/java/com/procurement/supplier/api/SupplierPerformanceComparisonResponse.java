package com.procurement.supplier.api;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record SupplierPerformanceComparisonResponse(
    String relationId,
    String supplierId,
    String supplierName,
    String status,
    String level,
    String cooperationTier,
    String evaluationId,
    BigDecimal qualityScore,
    BigDecimal deliveryScore,
    BigDecimal priceScore,
    BigDecimal serviceScore,
    BigDecimal totalScore,
    OffsetDateTime evaluatedAt,
    int receiptCount,
    int onTimeCount,
    Integer onTimeRate,
    long totalReceived,
    long totalQualified,
    Integer qualifiedRate,
    int scheduledReceiptCount) {
}
