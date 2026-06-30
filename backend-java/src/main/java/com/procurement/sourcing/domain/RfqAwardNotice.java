package com.procurement.sourcing.domain;

import java.time.OffsetDateTime;

// 中标通知书签发记录(电子签章留痕)。
public record RfqAwardNotice(
    String rfqId,
    String tenantId,
    String awardId,
    String sealNo,
    String issuedBy,
    OffsetDateTime issuedAt) {
}
