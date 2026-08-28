package com.procurement.process.api;

import jakarta.validation.constraints.NotBlank;

// 新建流程:仅名称必填;描述/图标可选(默认草稿,空表单/流程)。
public record CreateProcessDefinitionRequest(
    @NotBlank String name,
    String description,
    String icon,
    String businessType) {

  // 兼容旧客户端；业务类型可以在首次保存草稿时补齐，但发布前必须存在。
  public CreateProcessDefinitionRequest(String name, String description, String icon) {
    this(name, description, icon, null);
  }
}
