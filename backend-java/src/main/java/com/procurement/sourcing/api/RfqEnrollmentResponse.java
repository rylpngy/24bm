package com.procurement.sourcing.api;

import java.time.OffsetDateTime;

// 报名记录(买方视角):待处理 / 已受邀 / 已忽略;matchedSupplierId 为按企业名匹配到的平台认证供应商。
public record RfqEnrollmentResponse(
    String id,
    String rfqId,
    String companyName,
    String contactName,
    String contactPhone,
    String note,
    String status,
    OffsetDateTime createdAt,
    String matchedSupplierId) {
}
