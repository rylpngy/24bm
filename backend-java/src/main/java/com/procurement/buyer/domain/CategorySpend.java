package com.procurement.buyer.domain;

import java.math.BigDecimal;

public record CategorySpend(String category, BigDecimal totalAmount) {
}
