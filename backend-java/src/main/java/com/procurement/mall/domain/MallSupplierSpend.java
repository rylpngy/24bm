package com.procurement.mall.domain;

import java.math.BigDecimal;

public record MallSupplierSpend(
    String supplierId, String supplierName, int orderCount, BigDecimal totalAmount) {
}
