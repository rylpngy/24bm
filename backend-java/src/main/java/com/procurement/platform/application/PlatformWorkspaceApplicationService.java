package com.procurement.platform.application;

import com.procurement.platform.api.PlatformWorkspaceResponse;
import org.springframework.stereotype.Service;

@Service
public class PlatformWorkspaceApplicationService {
  private final PlatformOverviewApplicationService platformOverviewApplicationService;
  private final PlatformTenantApplicationService platformTenantApplicationService;
  private final PlatformEnterpriseApplicationService platformEnterpriseApplicationService;

  public PlatformWorkspaceApplicationService(
      PlatformOverviewApplicationService platformOverviewApplicationService,
      PlatformTenantApplicationService platformTenantApplicationService,
      PlatformEnterpriseApplicationService platformEnterpriseApplicationService) {
    this.platformOverviewApplicationService = platformOverviewApplicationService;
    this.platformTenantApplicationService = platformTenantApplicationService;
    this.platformEnterpriseApplicationService = platformEnterpriseApplicationService;
  }

  public PlatformWorkspaceResponse load() {
    return new PlatformWorkspaceResponse(
        platformOverviewApplicationService.overview(),
        platformTenantApplicationService.listTenants(),
        platformEnterpriseApplicationService.listPendingReviews());
  }
}
