package com.procurement.approval.api;

public record UpdateApprovalTemplateRequest(
    String defaultApproverRoleId,
    String status) {
}
