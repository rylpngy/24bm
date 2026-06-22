package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.procurement.platform.api.EnterpriseReviewResponse;
import com.procurement.platform.api.PlatformOverviewResponse;
import com.procurement.platform.api.PlatformWorkspaceResponse;
import com.procurement.platform.api.TenantResponse;
import com.procurement.platform.application.PlatformEnterpriseApplicationService;
import com.procurement.platform.application.PlatformOverviewApplicationService;
import com.procurement.platform.application.PlatformTenantApplicationService;
import com.procurement.platform.application.PlatformWorkspaceApplicationService;
import java.util.List;
import org.junit.jupiter.api.Test;

class PlatformWorkspaceOperationSummaryTests {

  private final PlatformOverviewApplicationService platformOverviewApplicationService =
      org.mockito.Mockito.mock(PlatformOverviewApplicationService.class);
  private final PlatformTenantApplicationService platformTenantApplicationService =
      org.mockito.Mockito.mock(PlatformTenantApplicationService.class);
  private final PlatformEnterpriseApplicationService platformEnterpriseApplicationService =
      org.mockito.Mockito.mock(PlatformEnterpriseApplicationService.class);
  private final PlatformWorkspaceApplicationService platformWorkspaceApplicationService =
      new PlatformWorkspaceApplicationService(
          platformOverviewApplicationService,
          platformTenantApplicationService,
          platformEnterpriseApplicationService);

  @Test
  void platformWorkspaceSummarizesOperatingCounts() {
    when(platformOverviewApplicationService.overview())
        .thenReturn(new PlatformOverviewResponse("platform", 3, 5, 2));
    when(platformTenantApplicationService.listTenants()).thenReturn(List.of(
        tenant("tenant-active-1", "active"),
        tenant("tenant-active-2", "active"),
        tenant("tenant-disabled", "inactive")));
    when(platformEnterpriseApplicationService.listPendingReviews()).thenReturn(List.of(
        review("review-1"),
        review("review-2")));

    PlatformWorkspaceResponse response = platformWorkspaceApplicationService.load();

    assertThat(response.operationSummary().tenantCount()).isEqualTo(3);
    assertThat(response.operationSummary().activeTenantCount()).isEqualTo(2);
    assertThat(response.operationSummary().publicSupplierCount()).isEqualTo(5);
    assertThat(response.operationSummary().pendingEnterpriseReviewCount()).isEqualTo(2);
  }

  private TenantResponse tenant(String id, String status) {
    return new TenantResponse(
        id,
        id,
        "MVP",
        status,
        List.of("rfq", "order"),
        100);
  }

  private EnterpriseReviewResponse review(String id) {
    return new EnterpriseReviewResponse(
        id,
        "晨光科技供应商",
        "supplier",
        false,
        "pending",
        null,
        false,
        false);
  }
}
