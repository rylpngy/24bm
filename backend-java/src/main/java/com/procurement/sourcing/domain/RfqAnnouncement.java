package com.procurement.sourcing.domain;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

// 采购公告:由业务事件(发布/补遗/再次报价/定标/终止)自动生成的模板化公告记录。
public record RfqAnnouncement(
    String id,
    String tenantId,
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
    OffsetDateTime publishedAt) {
}
