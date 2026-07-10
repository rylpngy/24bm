package com.procurement.supplier.domain;

import java.math.BigDecimal;

public record BuyerSupplierRelation(
    String id,
    String tenantId,
    String supplierId,
    String supplierName,
    String status,
    String level,
    String categoriesJson,
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
