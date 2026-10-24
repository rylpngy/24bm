package com.procurement.mall.api;

import java.math.BigDecimal;

public record MallComparisonRow(String productId,String skuId,String productName,String brand,
    String supplierName,String skuCode,String spec,String unit,BigDecimal unitPrice,BigDecimal total,
    int leadTimeDays,BigDecimal stockQty,boolean sameSpecification) {}
