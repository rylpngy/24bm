package com.procurement.process.api;

import jakarta.validation.constraints.NotBlank;

// 审批流程实例:decision ∈ approve / reject;comment 可选。
public record ReviewProcessInstanceRequest(
    @NotBlank String decision,
    String comment) {
}
