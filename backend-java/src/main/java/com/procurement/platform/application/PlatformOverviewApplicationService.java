package com.procurement.platform.application;

import com.procurement.platform.api.PlatformBusinessMetricsResponse;
import com.procurement.platform.api.PlatformOverviewResponse;
import com.procurement.platform.infrastructure.PlatformEnterpriseMapper;
import com.procurement.platform.infrastructure.PlatformMetricsMapper;
import com.procurement.platform.infrastructure.PlatformTenantMapper;
import org.springframework.stereotype.Service;

@Service
public class PlatformOverviewApplicationService {
  private final PlatformTenantMapper platformTenantMapper;
  private final PlatformEnterpriseMapper platformEnterpriseMapper;
  private final PlatformMetricsMapper platformMetricsMapper;

  public PlatformOverviewApplicationService(
      PlatformTenantMapper platformTenantMapper,
      PlatformEnterpriseMapper platformEnterpriseMapper,
      PlatformMetricsMapper platformMetricsMapper) {
    this.platformTenantMapper = platformTenantMapper;
    this.platformEnterpriseMapper = platformEnterpriseMapper;
    this.platformMetricsMapper = platformMetricsMapper;
  }

  /** 平台经营看板:跨租户真实聚合(交易规模/活跃度/供应商生态/方式分布/月度趋势)。 */
  public PlatformBusinessMetricsResponse businessMetrics() {
    return new PlatformBusinessMetricsResponse(
        platformMetricsMapper.countOrders(),
        platformMetricsMapper.sumOrderAmount(),
        platformMetricsMapper.countContracts(),
        platformMetricsMapper.sumContractAmount(),
        platformMetricsMapper.countRecentOrders(),
        platformMetricsMapper.sumRecentOrderAmount(),
        platformMetricsMapper.countActiveTenants(),
        platformMetricsMapper.countVerifiedSuppliers(),
        platformMetricsMapper.countRecentSuppliers(),
        platformMetricsMapper.listMethodShares(),
        platformMetricsMapper.listMonthlyTrends());
  }

  public PlatformOverviewResponse overview() {
    int tenantCount = platformTenantMapper.countAll();
    int publicSupplierCount = platformEnterpriseMapper.countPublicSuppliers();
    int pendingEnterpriseReviews = platformEnterpriseMapper.listPendingReviews().size();
    return new PlatformOverviewResponse("platform", tenantCount, publicSupplierCount, pendingEnterpriseReviews);
  }
}
