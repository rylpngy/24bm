package com.procurement.sourcing.api;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

// 门户公开采购公告(公开安全字段 + 采购人名称)。
public record PublicProcurementAnnouncementResponse(
    String id,
    String rfqId,
    String type,
    String title,
    String summary,
    String method,
    OffsetDateTime deadlineAt,
    String evaluationMethod,
    String quoteRequirement,
    String deliveryRequirement,
    String awardedSupplierName,
    BigDecimal awardAmount,
    String closeReason,
    OffsetDateTime publishedAt,
    String buyerName) {
}
