package com.procurement.identity.api;

import java.util.List;

public record BuyerUserResponse(
    String id,
    String tenantId,
    String name,
    String mobile,
    String email,
    String status,
    String departmentId,
    String roleId,
    String employeeNo,
    String jobTitle,
    List<String> roleIds) {

  public BuyerUserResponse(
      String id,
      String tenantId,
      String name,
      String mobile,
      String email,
      String status,
      String departmentId,
      String roleId,
      String employeeNo,
      String jobTitle) {
    this(id, tenantId, name, mobile, email, status, departmentId, roleId, employeeNo, jobTitle,
        roleId == null ? List.of() : List.of(roleId));
  }

  // 兼容旧调用(无工号/职位)。
  public BuyerUserResponse(
      String id,
      String tenantId,
      String name,
      String mobile,
      String email,
      String status,
      String departmentId,
      String roleId) {
    this(id, tenantId, name, mobile, email, status, departmentId, roleId, null, "",
        roleId == null ? List.of() : List.of(roleId));
  }
}
