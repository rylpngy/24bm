package com.procurement.identity.api;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;

/**
 * 采购方成员档案维护。
 *
 * <p>状态和密码分别走独立动作，避免一次资料编辑意外停用账号或重置密码。</p>
 * <p>roleIds 存在时以其完整角色集合为准；省略时兼容旧 roleId 行为。</p>
 */
public record UpdateBuyerUserRequest(
    @NotBlank String name,
    String mobile,
    @Email String email,
    @NotBlank String departmentId,
    String roleId,
    String employeeNo,
    String jobTitle,
    @Size(min = 1) List<@NotBlank String> roleIds) {

  @AssertTrue(message = "请至少选择一个有效角色")
  @com.fasterxml.jackson.annotation.JsonIgnore
  public boolean isRoleSelectionValid() {
    return roleIds == null ? roleId != null && !roleId.isBlank() : !roleIds.isEmpty();
  }

  public UpdateBuyerUserRequest(String name, String mobile, String email, String departmentId,
      String roleId, String employeeNo, String jobTitle) {
    this(name, mobile, email, departmentId, roleId, employeeNo, jobTitle, null);
  }
}
