package com.procurement.platform.api;

import java.math.BigDecimal;
import java.util.List;

// 租户用量与计费:套餐 + 各计量项配额/用量/超额 + 月基础费 + 超额合计 + 应付合计。
public record TenantUsageResponse(
    String tenantId,
    String tenantName,
    String planCode,
    String planName,
    BigDecimal monthlyBasePrice,
    List<UsageLineResponse> lines,
    BigDecimal overageTotal,
    BigDecimal totalBill) {
}
