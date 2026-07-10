package com.procurement.process.api;

import jakarta.validation.constraints.NotBlank;

// 保存/发布流程:整体更新名称/描述/状态 + 表单与流程 schema(JSON 文本)。
public record UpdateProcessDefinitionRequest(
    @NotBlank String name,
    String description,
    @NotBlank String status,
    @NotBlank String formSchema,
    @NotBlank String flowSchema) {
}
