package com.procurement.identity.domain;

import java.util.List;

public final class BuyerRoleAssignments {
  private BuyerRoleAssignments() {}

  public static List<String> resolve(List<String> roleIds, String legacyRoleId) {
    List<String> submitted = roleIds == null
        ? (legacyRoleId == null ? List.of() : List.of(legacyRoleId)) : roleIds;
    if (submitted.isEmpty() || submitted.stream().anyMatch(id -> id == null || id.isBlank())) {
      throw new IllegalArgumentException("请至少选择一个有效角色");
    }
    return submitted.stream().distinct().toList();
  }
}
