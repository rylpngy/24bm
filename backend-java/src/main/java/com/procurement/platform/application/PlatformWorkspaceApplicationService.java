package com.procurement.platform.application;

import com.procurement.platform.api.EnterpriseReviewResponse;
import com.procurement.platform.api.PlatformOperationSummaryResponse;
import com.procurement.platform.api.PlatformOverviewResponse;
import com.procurement.platform.api.PlatformWorkspaceResponse;
import com.procurement.platform.api.TenantResponse;
import com.procurement.platform.domain.PlatformTenantStatus;
import java.util.List;
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
    PlatformOverviewResponse overview = platformOverviewApplicationService.overview();
    List<TenantResponse> tenants = platformTenantApplicationService.listTenants();
    List<EnterpriseReviewResponse> enterpriseReviews = platformEnterpriseApplicationService.listPendingReviews();

    return new PlatformWorkspaceResponse(
        overview,
        summarizeOperations(overview, tenants, enterpriseReviews),
        tenants,
        enterpriseReviews);
  }

  private PlatformOperationSummaryResponse summarizeOperations(
      PlatformOverviewResponse overview,
      List<TenantResponse> tenants,
      List<EnterpriseReviewResponse> enterpriseReviews) {
    return new PlatformOperationSummaryResponse(
        overview.tenantCount(),
        tenants.stream()
            .filter(tenant -> PlatformTenantStatus.ACTIVE.equals(tenant.status()))
            .count(),
        overview.publicSupplierCount(),
        enterpriseReviews.size());
  }
}
