package com.procurement.identity.api;

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
    String jobTitle) {

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
    this(id, tenantId, name, mobile, email, status, departmentId, roleId, null, "");
  }
}
