package com.procurement.approval.domain;

public record ApprovalTemplate(
    String templateCode,
    String tenantId,
    String bizType,
    String name,
    String defaultApproverRoleId,
    String status) {
}
