package com.procurement.esign.api;

import java.time.OffsetDateTime;

public record EsignRecordResponse(
    String id,
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
