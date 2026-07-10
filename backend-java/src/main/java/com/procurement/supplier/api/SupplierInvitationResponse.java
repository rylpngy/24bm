package com.procurement.supplier.api;

import java.time.OffsetDateTime;

// 邀请单视图:含是否关联已知供应商(accepted 时可桥接为私域待准入)。
public record SupplierInvitationResponse(
    String id,
    String supplierId,
    String supplierName,
    String contact,
    String category,
    String note,
    String status,
    boolean linkedToKnownSupplier,
    OffsetDateTime createdAt,
    OffsetDateTime respondedAt) {}
