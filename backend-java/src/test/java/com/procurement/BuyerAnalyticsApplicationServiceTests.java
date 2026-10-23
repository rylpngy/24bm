package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.procurement.buyer.api.ProcurementAnalyticsResponse;
import com.procurement.buyer.application.BuyerAnalyticsApplicationService;
import com.procurement.buyer.domain.MonthlySpend;
import com.procurement.buyer.domain.StatusSlice;
import com.procurement.buyer.domain.SupplierSpend;
import com.procurement.buyer.infrastructure.BuyerAnalyticsMapper;
import com.procurement.common.tenant.TenantContext;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

// 采购洞察:总支出/订单数/供应商集中度/比价节支 的聚合口径。
class BuyerAnalyticsApplicationServiceTests {

  private final BuyerAnalyticsMapper mapper = mock(BuyerAnalyticsMapper.class);
  private final BuyerAnalyticsApplicationService service =
      new BuyerAnalyticsApplicationService(mapper,
          mock(com.procurement.identity.application.PermissionService.class), TestDataScopes.unrestricted());

  @AfterEach
  void clear() {
    TenantContext.clear();
  }

  @Test
  void aggregatesSpendConcentrationAndSavings() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(mapper.supplierSpend("tenant-1", com.procurement.identity.domain.DataScope.unrestricted()))
        .thenReturn(List.of(
            new SupplierSpend("sup-a", "甲供应商", new BigDecimal("80000"), 3),
            new SupplierSpend("sup-b", "乙供应商", new BigDecimal("20000"), 1)));
    when(mapper.monthlySpend("tenant-1", com.procurement.identity.domain.DataScope.unrestricted()))
        .thenReturn(List.of(new MonthlySpend("2026-06", new BigDecimal("100000"), 4)));
    when(mapper.statusDistribution("tenant-1", com.procurement.identity.domain.DataScope.unrestricted()))
        .thenReturn(List.of(new StatusSlice("已收货", 2, new BigDecimal("60000"))));
    when(mapper.biddingSavings("tenant-1", com.procurement.identity.domain.DataScope.unrestricted())).thenReturn(new BigDecimal("7000"));

    ProcurementAnalyticsResponse a = service.procurementAnalytics();

    assertThat(a.totalSpend()).isEqualByComparingTo("100000");
    assertThat(a.orderCount()).isEqualTo(4);
    assertThat(a.supplierCount()).isEqualTo(2);
    assertThat(a.biddingSavings()).isEqualByComparingTo("7000");
    assertThat(a.topSupplierSharePercent()).isEqualTo(80); // 80000 / 100000
    assertThat(a.supplierSpend().get(0).sharePercent()).isEqualTo(80);
    assertThat(a.monthlySpend()).hasSize(1);
  }

  @Test
  void emptyDataYieldsZerosAndNullShare() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(mapper.supplierSpend("tenant-1", com.procurement.identity.domain.DataScope.unrestricted())).thenReturn(List.of());
    when(mapper.monthlySpend("tenant-1", com.procurement.identity.domain.DataScope.unrestricted())).thenReturn(List.of());
    when(mapper.statusDistribution("tenant-1", com.procurement.identity.domain.DataScope.unrestricted())).thenReturn(List.of());
    when(mapper.biddingSavings("tenant-1", com.procurement.identity.domain.DataScope.unrestricted())).thenReturn(null);

    ProcurementAnalyticsResponse a = service.procurementAnalytics();

    assertThat(a.totalSpend()).isEqualByComparingTo("0");
    assertThat(a.topSupplierSharePercent()).isNull();
    assertThat(a.biddingSavings()).isEqualByComparingTo("0");
  }
}
