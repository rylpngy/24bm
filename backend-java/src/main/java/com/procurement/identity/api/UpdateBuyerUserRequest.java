package com.procurement.identity.api;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * 采购方成员档案维护。
 *
 * <p>状态和密码分别走独立动作，避免一次资料编辑意外停用账号或重置密码。</p>
 */
public record UpdateBuyerUserRequest(
    @NotBlank String name,
    String mobile,
    @Email String email,
    @NotBlank String departmentId,
    @NotBlank String roleId,
    String employeeNo,
    String jobTitle) {}
