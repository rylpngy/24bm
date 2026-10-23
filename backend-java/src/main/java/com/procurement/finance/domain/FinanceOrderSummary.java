package com.procurement.finance.domain;

import java.math.BigDecimal;

public record FinanceOrderSummary(String status, long orderCount, BigDecimal amount) {}
