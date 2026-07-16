package com.procurement.tender.api;

import java.time.OffsetDateTime;

public record TenderAcquisitionResponse(
    String supplierId,
    String supplierName,
    String source,
    OffsetDateTime acquiredAt) {
}
