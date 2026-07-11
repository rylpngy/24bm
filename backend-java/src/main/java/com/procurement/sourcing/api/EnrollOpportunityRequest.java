package com.procurement.sourcing.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

// 公开商机报名登记:门户访客提交企业与联系人信息,采购方审核后可转为正式邀请。
public record EnrollOpportunityRequest(
    @NotBlank @Size(max = 100) String companyName,
    @NotBlank @Size(max = 50) String contactName,
    @NotBlank @Size(max = 30) String contactPhone,
    @Size(max = 500) String note) {
}
