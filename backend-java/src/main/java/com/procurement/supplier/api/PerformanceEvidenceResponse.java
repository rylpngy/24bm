package com.procurement.supplier.api;

import java.time.OffsetDateTime;

public record PerformanceEvidenceResponse(String id, int round, String fileName, long size,
    String sha256, String uploaderName, OffsetDateTime createdAt) {}
