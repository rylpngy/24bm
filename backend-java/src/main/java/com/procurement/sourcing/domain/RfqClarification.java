package com.procurement.sourcing.domain;

import java.time.OffsetDateTime;

// 询价澄清:供应商提问 + 采购方答复(published=是否广播给全部受邀供应商)。
public record RfqClarification(
    String id,
    String tenantId,
    String rfqId,
    String supplierId,
    String question,
    String answer,
    String answeredBy,
    boolean published,
    OffsetDateTime askedAt,
    OffsetDateTime answeredAt) {
}
