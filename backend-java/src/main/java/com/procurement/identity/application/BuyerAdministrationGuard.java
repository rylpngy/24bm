package com.procurement.identity.application;

import com.procurement.identity.infrastructure.BuyerAdministrationMapper;

final class BuyerAdministrationGuard {
  private final BuyerAdministrationMapper mapper;

  BuyerAdministrationGuard(BuyerAdministrationMapper mapper) {
    this.mapper = mapper;
  }

  int lockAndCount(String tenantId) {
    // The caller's transaction holds this lock through permission checks, writes and postcondition.
    mapper.lockAdministrationTenant(tenantId);
    return mapper.countActiveFullAdministrators(tenantId);
  }

  void requireAdministratorPreserved(String tenantId, int before) {
    if (before > 0 && mapper.countActiveFullAdministrators(tenantId) == 0) {
      throw new IllegalStateException("不能移除企业最后一名有效管理员，请先授权另一名在职成员");
    }
  }
}
