package com.procurement.supplier.api;

import jakarta.validation.constraints.*;
import java.util.List;

public final class SupplierTeamRoleModels {
  private SupplierTeamRoleModels() {}
  public record Save(@NotBlank @Size(max=80) String name, @NotEmpty @Size(max=40) List<@NotBlank String> permissions) {}
  public record Assign(@NotEmpty @Size(max=20) List<@NotBlank String> roleIds) {}
  public record Role(String id, String name, List<String> permissions, boolean system) {}
  public record Permission(String code, String label) {}
  public record Assignment(String userId, List<String> roleIds) {}
  public record Workspace(List<Role> roles, List<Permission> permissions, List<Assignment> assignments) {}
}
