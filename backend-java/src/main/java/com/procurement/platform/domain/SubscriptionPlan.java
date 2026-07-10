package com.procurement.platform.domain;

import java.math.BigDecimal;

public record SubscriptionPlan(String code, String name, BigDecimal monthlyBasePrice) {
}
