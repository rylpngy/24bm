package com.procurement.supplier.domain;

import java.time.OffsetDateTime;

// 邀请单:采购方向供应商发起的独立邀请(注册 / 补资料 / 入私域)。
public record SupplierInvitation(
    String id,
    String tenantId,
    String supplierId,
    String supplierName,
    String contact,
    String category,
    String note,
    String status,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt,
    OffsetDateTime respondedAt,
    String buyerName) {}
