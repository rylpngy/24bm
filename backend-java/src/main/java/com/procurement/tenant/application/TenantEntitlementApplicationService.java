package com.procurement.tenant.application;

import com.procurement.tenant.infrastructure.TenantEntitlementMapper;
import org.springframework.stereotype.Service;

@Service
public class TenantEntitlementApplicationService {
  private final TenantEntitlementMapper tenantEntitlementMapper;

  public TenantEntitlementApplicationService(TenantEntitlementMapper tenantEntitlementMapper) {
    this.tenantEntitlementMapper = tenantEntitlementMapper;
  }

  public void requireUserCapacity(String tenantId, int currentUserCount) {
    Integer userLimit = tenantEntitlementMapper.findUserLimit(tenantId);
    if (userLimit == null) {
      throw new IllegalArgumentException("Tenant not found: " + tenantId);
    }
    if (currentUserCount >= userLimit) {
      throw new IllegalStateException("Tenant user limit reached: " + userLimit);
    }
  }
}
