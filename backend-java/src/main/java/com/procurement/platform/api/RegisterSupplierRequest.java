package com.procurement.platform.api;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

// 门户供应商入驻申请:提交后进入平台企业审核工作流(待初审→初审通过→准入通过)。
public record RegisterSupplierRequest(
    @NotBlank @Size(max = 100) String companyName,
    @NotBlank @Size(max = 50) String industry,
    @NotBlank @Size(max = 30) String creditCode,
    @NotBlank @Size(max = 50) String legalPerson,
    @NotBlank @Size(max = 50) String contactName,
    @NotBlank @Size(max = 30) String contactPhone,
    @NotBlank @Email @Size(max = 100) String contactEmail,
    @Size(max = 500) String businessScope) {
}
