package com.procurement.sourcing.api;

import java.time.OffsetDateTime;

// 公开商机:平台上采购人发布的项目公开信息(跨租户,仅安全字段 + 采购方企业名)。
public record PublicOpportunityResponse(
    String id,
    String title,
    String method,
    String evaluationMethod,
    String status,
    OffsetDateTime deadlineAt,
    OffsetDateTime createdAt,
    OffsetDateTime resultAnnouncedAt,
    String quoteRequirement,
    String deliveryRequirement,
    String buyerName,
    java.math.BigDecimal budget,
    String categories) {
}
