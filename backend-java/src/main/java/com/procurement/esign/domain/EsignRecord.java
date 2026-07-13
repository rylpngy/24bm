package com.procurement.esign.domain;

import java.time.OffsetDateTime;

public record EsignRecord(
    String id,
    String tenantId,
    String targetType,
    String targetId,
    String signerScope,
    String signerId,
    String signerName,
    String enterpriseId,
    String contentDigest,
    String signatureImage,
    OffsetDateTime signedAt,
    String remark) {
}
