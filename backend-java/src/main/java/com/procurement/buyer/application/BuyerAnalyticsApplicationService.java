package com.procurement.buyer.application;

import com.procurement.buyer.api.MonthlySpendResponse;
import com.procurement.buyer.api.ProcurementAnalyticsResponse;
import com.procurement.buyer.api.CategorySpendResponse;
import com.procurement.buyer.api.StatusSliceResponse;
import com.procurement.buyer.api.SupplierSpendResponse;
import com.procurement.buyer.domain.MonthlySpend;
import com.procurement.buyer.domain.StatusSlice;
import com.procurement.buyer.domain.SupplierSpend;
import com.procurement.buyer.infrastructure.BuyerAnalyticsMapper;
import com.procurement.common.tenant.TenantAccessGuard;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import org.springframework.stereotype.Service;

// 采购洞察:把订单/报价数据聚合为支出趋势、供应商集中度、状态分布与比价节支。
@Service
public class BuyerAnalyticsApplicationService {
  private final BuyerAnalyticsMapper analyticsMapper;
  private final com.procurement.identity.application.PermissionService permissions;
  private final com.procurement.identity.application.DataScopeService scopes;

  public BuyerAnalyticsApplicationService(BuyerAnalyticsMapper analyticsMapper,
      com.procurement.identity.application.PermissionService permissions,
      com.procurement.identity.application.DataScopeService scopes) {
    this.analyticsMapper = analyticsMapper;
    this.permissions = permissions;
    this.scopes = scopes;
  }

  public ProcurementAnalyticsResponse procurementAnalytics() {
    String tenantId = TenantAccessGuard.requireTenantId("analytics APIs");
    permissions.require("buyer:analytics:read");
    var scope = scopes.currentUserDataScope();

    List<MonthlySpend> monthly = analyticsMapper.monthlySpend(tenantId, scope);
    List<SupplierSpend> suppliers = analyticsMapper.supplierSpend(tenantId, scope);
    List<StatusSlice> statuses = analyticsMapper.statusDistribution(tenantId, scope);
    BigDecimal savings = analyticsMapper.biddingSavings(tenantId, scope);
    List<com.procurement.buyer.domain.CategorySpend> categories = analyticsMapper.categorySpend(tenantId, scope);

    BigDecimal totalSpend =
        suppliers.stream().map(SupplierSpend::totalAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
    int orderCount = suppliers.stream().mapToInt(SupplierSpend::orderCount).sum();

    // 头部供应商集中度 = 支出最高供应商占总支出比例。
    Integer topShare = null;
    if (!suppliers.isEmpty() && totalSpend.compareTo(BigDecimal.ZERO) > 0) {
      topShare =
          suppliers.get(0).totalAmount()
              .multiply(BigDecimal.valueOf(100))
              .divide(totalSpend, 0, RoundingMode.HALF_UP)
              .intValue();
    }

    List<SupplierSpendResponse> supplierResponses =
        suppliers.stream()
            .map(
                s -> {
                  Integer share =
                      totalSpend.compareTo(BigDecimal.ZERO) > 0
                          ? s.totalAmount()
                              .multiply(BigDecimal.valueOf(100))
                              .divide(totalSpend, 0, RoundingMode.HALF_UP)
                              .intValue()
                          : null;
                  return new SupplierSpendResponse(
                      s.supplierId(), s.supplierName(), s.totalAmount(), s.orderCount(), share);
                })
            .toList();

    return new ProcurementAnalyticsResponse(
        totalSpend,
        orderCount,
        suppliers.size(),
        savings == null ? BigDecimal.ZERO : savings,
        topShare,
        monthly.stream()
            .map(m -> new MonthlySpendResponse(m.period(), m.totalAmount(), m.orderCount()))
            .toList(),
        supplierResponses,
        statuses.stream()
            .map(s -> new StatusSliceResponse(s.status(), s.orderCount(), s.totalAmount()))
            .toList(),
        categories.stream()
            .map(c -> new CategorySpendResponse(c.category(), c.totalAmount()))
            .toList());
  }
}
