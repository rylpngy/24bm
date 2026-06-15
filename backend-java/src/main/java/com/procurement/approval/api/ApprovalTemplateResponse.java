package com.procurement.approval.api;

public record ApprovalTemplateResponse(
    String templateCode,
    String bizType,
    String name,
    String defaultApproverRoleId,
    String status) {
}
