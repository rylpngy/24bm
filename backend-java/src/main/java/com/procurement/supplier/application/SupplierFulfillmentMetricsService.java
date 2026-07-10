package com.procurement.supplier.application;

import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.supplier.api.SupplierFulfillmentMetricsResponse;
import com.procurement.supplier.domain.SupplierFulfillmentMetrics;
import com.procurement.supplier.infrastructure.SupplierFulfillmentMetricsMapper;
import org.springframework.stereotype.Service;

// 供应商绩效闭环:把真实收货验收数据导出为质量分(合格率)与交付分(准时率),
// 供 SRM 绩效评分回填(实测 → 评分 → 生命周期标记)。
@Service
public class SupplierFulfillmentMetricsService {
  private final SupplierFulfillmentMetricsMapper metricsMapper;

  public SupplierFulfillmentMetricsService(SupplierFulfillmentMetricsMapper metricsMapper) {
    this.metricsMapper = metricsMapper;
  }

  public SupplierFulfillmentMetricsResponse metricsForSupplier(String supplierId) {
    String tenantId = TenantAccessGuard.requireTenantId("supplier metrics APIs");
    SupplierFulfillmentMetrics m = metricsMapper.aggregate(tenantId, supplierId);
    int receiptCount = m == null ? 0 : m.receiptCount();
    int onTimeCount = m == null ? 0 : m.onTimeCount();
    long totalReceived = m == null ? 0 : m.totalReceived();
    long totalQualified = m == null ? 0 : m.totalQualified();

    Integer onTimeRate = receiptCount > 0 ? Math.round(onTimeCount * 100f / receiptCount) : null;
    Integer qualifiedRate = totalReceived > 0 ? Math.round(totalQualified * 100f / totalReceived) : null;

    return new SupplierFulfillmentMetricsResponse(
        supplierId,
        receiptCount,
        onTimeCount,
        onTimeRate,
        totalReceived,
        totalQualified,
        qualifiedRate,
        qualifiedRate, // 实测质量分 = 合格率
        onTimeRate); // 实测交付分 = 准时率
  }
}
