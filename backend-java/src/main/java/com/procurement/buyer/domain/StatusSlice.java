package com.procurement.buyer.domain;

import java.math.BigDecimal;

public record StatusSlice(String status, int orderCount, BigDecimal totalAmount) {
}
