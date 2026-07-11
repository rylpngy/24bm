package com.procurement.platform.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

// 平台侧开通供应商企业:干净环境引导链路(供应商无自助注册,由平台运营建档)。
public record CreateSupplierEnterpriseRequest(
    @NotBlank String enterpriseId,
    @NotBlank String name,
    @NotBlank String industry,
    String creditCode,
    String legalPerson,
    @NotBlank String adminName,
    String adminMobile,
    @NotBlank String adminEmail,
    @NotBlank @Size(min = 8) String adminPassword) {
}
