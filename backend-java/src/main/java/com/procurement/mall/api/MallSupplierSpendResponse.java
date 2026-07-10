package com.procurement.mall.api;

import java.math.BigDecimal;

public record MallSupplierSpendResponse(
    String supplierId, String supplierName, int orderCount, BigDecimal totalAmount) {
}
