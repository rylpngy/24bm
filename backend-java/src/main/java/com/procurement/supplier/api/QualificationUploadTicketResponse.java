package com.procurement.supplier.api;

import java.time.OffsetDateTime;

/** 资质证照上传票据:前端按 uploadUrl 直传字节,再以 storageKey 建档。 */
public record QualificationUploadTicketResponse(
    String fileName,
    String storageKey,
    String uploadUrl,
    OffsetDateTime issuedAt,
    OffsetDateTime expiresAt) {
}
