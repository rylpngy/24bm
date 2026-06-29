package com.procurement.identity.api;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record CreateBuyerUserRequest(
    @NotBlank String name,
    String mobile,
    @Email String email,
    @NotBlank String status,
    @NotBlank String departmentId,
    @NotBlank String roleId,
    @NotBlank String initialPassword,
    String employeeNo,
    String jobTitle) {

  // 兼容旧调用(无工号/职位)。
  public CreateBuyerUserRequest(
      String name,
      String mobile,
      String email,
      String status,
      String departmentId,
      String roleId,
      String initialPassword) {
    this(name, mobile, email, status, departmentId, roleId, initialPassword, null, "");
  }
}
