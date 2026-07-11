package com.procurement.platform.api;

// 公开门户供应商名录:仅暴露可公开字段(名称/行业/认证),不含证照与联系人隐私。
public record PublicSupplierResponse(
    String id,
    String name,
    String industry,
    Boolean verified,
    String verifiedStatus) {
}
