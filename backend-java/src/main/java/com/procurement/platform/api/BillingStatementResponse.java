package com.procurement.platform.api;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

// 账单(快照):头金额 + 状态/时间戳 + 各计量项快照行。
public record BillingStatementResponse(
    String id,
    String tenantId,
    String period,
    String planCode,
    BigDecimal basePrice,
    BigDecimal overageTotal,
    BigDecimal totalAmount,
    String status,
    OffsetDateTime generatedAt,
    OffsetDateTime issuedAt,
    OffsetDateTime paidAt,
    List<UsageLineResponse> lines) {
}
