package com.procurement.identity.api;

// 批量导入的一行成员(角色用名称,后端解析为 id)。
public record ImportBuyerUserRow(
    String name,
    String employeeNo,
    String jobTitle,
    String mobile,
    String email,
    String roleName) {
}
