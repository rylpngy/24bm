package com.procurement.sourcing.domain;

import java.time.OffsetDateTime;

public record ProcurementExecutionArchive(
    String id, String tenantId, String rfqId, String snapshot, String sha256,
    String createdBy, OffsetDateTime createdAt, String remark, byte[] zipData) {}
