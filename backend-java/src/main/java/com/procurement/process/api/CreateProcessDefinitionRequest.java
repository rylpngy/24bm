package com.procurement.process.api;

import jakarta.validation.constraints.NotBlank;

// 新建流程:仅名称必填;描述/图标可选(默认草稿,空表单/流程)。
public record CreateProcessDefinitionRequest(
    @NotBlank String name,
    String description,
    String icon) {
}
