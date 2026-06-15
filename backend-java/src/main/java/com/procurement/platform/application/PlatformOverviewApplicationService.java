package com.procurement.platform.application;

import com.procurement.platform.api.PlatformOverviewResponse;
import com.procurement.platform.infrastructure.PlatformEnterpriseMapper;
import com.procurement.platform.infrastructure.PlatformTenantMapper;
import org.springframework.stereotype.Service;

@Service
public class PlatformOverviewApplicationService {
  private final PlatformTenantMapper platformTenantMapper;
  private final PlatformEnterpriseMapper platformEnterpriseMapper;

  public PlatformOverviewApplicationService(
      PlatformTenantMapper platformTenantMapper,
      PlatformEnterpriseMapper platformEnterpriseMapper) {
    this.platformTenantMapper = platformTenantMapper;
    this.platformEnterpriseMapper = platformEnterpriseMapper;
  }

  public PlatformOverviewResponse overview() {
    int tenantCount = platformTenantMapper.countAll();
    int publicSupplierCount = platformEnterpriseMapper.countPublicSuppliers();
    int pendingEnterpriseReviews = platformEnterpriseMapper.listPendingReviews().size();
    return new PlatformOverviewResponse("platform", tenantCount, publicSupplierCount, pendingEnterpriseReviews);
  }
}
