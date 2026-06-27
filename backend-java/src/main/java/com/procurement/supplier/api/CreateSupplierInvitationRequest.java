package com.procurement.supplier.api;

import jakarta.validation.constraints.NotBlank;

// 发起邀请:supplierName 必填;supplierId 选填(关联平台已知供应商,接受时桥接为待准入)。
public record CreateSupplierInvitationRequest(
    String supplierId,
    @NotBlank String supplierName,
    String contact,
    String category,
    String note) {}
