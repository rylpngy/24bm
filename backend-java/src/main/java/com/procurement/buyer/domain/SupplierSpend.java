package com.procurement.buyer.domain;

import java.math.BigDecimal;

public record SupplierSpend(String supplierId, String supplierName, BigDecimal totalAmount, int orderCount) {
}
