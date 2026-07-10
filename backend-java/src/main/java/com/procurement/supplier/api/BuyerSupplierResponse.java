package com.procurement.supplier.api;

import java.math.BigDecimal;
import java.util.List;

public record BuyerSupplierResponse(
    String id,
    String tenantId,
    String supplierId,
    String supplierName,
    String status,
    String level,
    List<String> categories,
    BigDecimal performanceScore,
    String cooperationTier,
    BigDecimal lastEvaluationScore,
    String creditCode,
    String legalPerson,
    String contactName,
    String contactPhone,
    String contactEmail,
    String businessScope,
    String bankName,
    String bankAccount) {
}
