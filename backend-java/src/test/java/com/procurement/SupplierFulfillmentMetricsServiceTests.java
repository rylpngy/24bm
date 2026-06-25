package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.procurement.common.tenant.TenantContext;
import com.procurement.supplier.api.SupplierFulfillmentMetricsResponse;
import com.procurement.supplier.application.SupplierFulfillmentMetricsService;
import com.procurement.supplier.domain.SupplierFulfillmentMetrics;
import com.procurement.supplier.infrastructure.SupplierFulfillmentMetricsMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

// 供应商绩效闭环:实测质量分=合格率、交付分=准时率,由真实收货数据导出。
class SupplierFulfillmentMetricsServiceTests {

  private final SupplierFulfillmentMetricsMapper mapper = mock(SupplierFulfillmentMetricsMapper.class);
  private final SupplierFulfillmentMetricsService service =
      new SupplierFulfillmentMetricsService(mapper);

  @AfterEach
  void clear() {
    TenantContext.clear();
  }

  @Test
  void derivesQualityFromQualifiedRateAndDeliveryFromOnTimeRate() {
    TenantContext.set("tenant-1", null, "buyer-user");
    // 2 单验收,1 单准时;收货 504 合格 499。
    when(mapper.aggregate("tenant-1", "ent-supplier-sunrise"))
        .thenReturn(new SupplierFulfillmentMetrics(2, 1, 504L, 499L));

    SupplierFulfillmentMetricsResponse m = service.metricsForSupplier("ent-supplier-sunrise");

    assertThat(m.onTimeRate()).isEqualTo(50); // 1/2
    assertThat(m.qualifiedRate()).isEqualTo(99); // round(499*100/504)
    assertThat(m.derivedQualityScore()).isEqualTo(99);
    assertThat(m.derivedDeliveryScore()).isEqualTo(50);
  }

  @Test
  void noReceiptsYieldsNullRates() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(mapper.aggregate("tenant-1", "ent-supplier-new"))
        .thenReturn(new SupplierFulfillmentMetrics(0, 0, 0L, 0L));

    SupplierFulfillmentMetricsResponse m = service.metricsForSupplier("ent-supplier-new");

    assertThat(m.qualifiedRate()).isNull();
    assertThat(m.onTimeRate()).isNull();
    assertThat(m.receiptCount()).isZero();
  }
}
