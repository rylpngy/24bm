package com.procurement.identity.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

// 批量导入部门成员:统一初始密码 + 多行成员。逐行尽力创建,返回成功/失败明细。
public record ImportBuyerUsersRequest(
    @NotBlank String departmentId,
    @NotBlank String defaultPassword,
    @NotEmpty List<ImportBuyerUserRow> members) {
}
