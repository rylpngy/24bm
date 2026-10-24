package com.procurement.identity.api;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

/** roleIds, when present, replaces the legacy single roleId selection atomically with account creation. */
public record CreateBuyerUserRequest(
    @NotBlank String name,
    String mobile,
    @Email String email,
    @NotBlank String status,
    @NotBlank String departmentId,
    String roleId,
    @NotBlank String initialPassword,
    String employeeNo,
    String jobTitle,
    @Size(min = 1) List<@NotBlank String> roleIds) {

  @AssertTrue(message = "请至少选择一个有效角色")
  @com.fasterxml.jackson.annotation.JsonIgnore
  public boolean isRoleSelectionValid() {
    return roleIds == null ? roleId != null && !roleId.isBlank() : !roleIds.isEmpty();
  }

  public CreateBuyerUserRequest(String name, String mobile, String email, String status,
      String departmentId, String roleId, String initialPassword, String employeeNo, String jobTitle) {
    this(name, mobile, email, status, departmentId, roleId, initialPassword, employeeNo, jobTitle, null);
  }

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
