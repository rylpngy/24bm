package com.procurement.sourcing.api;

import java.time.OffsetDateTime;

// 中标通知书签发状态(电子签章信息)。
public record AwardNoticeResponse(
    String rfqId,
    boolean issued,
    String sealNo,
    String issuedBy,
    OffsetDateTime issuedAt,
    String winnerSupplierId,
    String signature) {
}
