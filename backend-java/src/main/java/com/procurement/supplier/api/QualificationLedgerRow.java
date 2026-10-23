package com.procurement.supplier.api;

import java.time.LocalDate;

public record QualificationLedgerRow(String relationId, String supplierName, String relationStatus,
    String qualificationId, String qualificationType, String certificateNo, LocalDate expiresAt,
    String expiryState) {}
