package com.procurement.buyer.domain;

import java.math.BigDecimal;

public record MonthlySpend(String period, BigDecimal totalAmount, int orderCount) {
}
