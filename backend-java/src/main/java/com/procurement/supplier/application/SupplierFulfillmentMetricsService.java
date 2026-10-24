package com.procurement.supplier.application;

import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.application.DataScopeService;
import com.procurement.identity.application.PermissionService;
import com.procurement.supplier.api.SupplierFulfillmentMetricsResponse;
import com.procurement.supplier.api.SupplierPerformanceComparisonResponse;
import com.procurement.supplier.domain.SupplierPerformancePeriod;
import com.procurement.supplier.domain.SupplierPeriodMetrics;
import com.procurement.supplier.infrastructure.BuyerSupplierRelationMapper;
import com.procurement.supplier.infrastructure.SupplierFulfillmentMetricsMapper;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SupplierFulfillmentMetricsService {
  private final SupplierFulfillmentMetricsMapper metricsMapper;
  private final BuyerSupplierRelationMapper relations;
  private final PermissionService permissions;
  private final DataScopeService scopes;

  public SupplierFulfillmentMetricsService(SupplierFulfillmentMetricsMapper metricsMapper,
      BuyerSupplierRelationMapper relations, PermissionService permissions, DataScopeService scopes) {
    this.metricsMapper = metricsMapper;
    this.relations = relations;
    this.permissions = permissions;
    this.scopes = scopes;
  }

  public SupplierFulfillmentMetricsResponse metricsForSupplier(String supplierId) {
    return metricsForSupplier(supplierId, null);
  }

  @Transactional(readOnly = true)
  public SupplierFulfillmentMetricsResponse metricsForSupplier(String supplierId, String value) {
    String tenantId = requireRead();
    SupplierPerformancePeriod period = value == null ? null : SupplierPerformancePeriod.parse(value);
    if (relations.countByTenantSupplier(tenantId, supplierId) == 0) {
      throw new IllegalArgumentException("未找到本企业供应商关系");
    }
    SupplierPeriodMetrics metrics = metricsMapper.aggregatePeriod(
        tenantId, supplierId, period, scopes.currentUserDataScope());
    if (metrics == null) metrics = new SupplierPeriodMetrics(0, 0, 0, 0, 0, null, null);
    return new SupplierFulfillmentMetricsResponse(
        supplierId, metrics.receiptCount(), metrics.onTimeCount(), metrics.onTimeRate(),
        metrics.totalReceived(), metrics.totalQualified(), metrics.qualifiedRate(),
        metrics.qualifiedRate(), metrics.onTimeRate(),
        period == null ? null : period.period(),
        period == null ? null : period.startDate(),
        period == null ? null : period.endDateExclusive(),
        metrics.scheduledReceiptCount());
  }

  @Transactional(readOnly = true)
  public List<SupplierPerformanceComparisonResponse> performanceComparison(String value) {
    String tenantId = requireRead();
    SupplierPerformancePeriod period = SupplierPerformancePeriod.parse(value);
    return metricsMapper.compare(tenantId, period, scopes.currentUserDataScope());
  }

  private String requireRead() {
    String tenantId = TenantAccessGuard.requireTenantId("供应商履约统计");
    permissions.require("buyer:supplier:read");
    return tenantId;
  }
}
