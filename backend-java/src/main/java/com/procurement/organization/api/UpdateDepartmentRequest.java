package com.procurement.organization.api;

import jakarta.validation.constraints.NotBlank;

// 编辑部门:名称必填;描述/负责人可选(managerId 传 null 表示清空负责人)。
public record UpdateDepartmentRequest(
    @NotBlank String name,
    String description,
    String managerId) {
}
