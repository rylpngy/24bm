package com.procurement.platform.api;

// 平台侧供应商开通结果:回显初始管理员用户 id,供 Keycloak 建号时填 userId/supplierId claim。
public record SupplierEnterpriseResponse(
    String enterpriseId,
    String name,
    String industry,
    String adminUserId,
    String adminEmail) {
}
