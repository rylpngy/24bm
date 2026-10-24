package com.procurement.buyer.application;

import com.procurement.buyer.api.MonthlySpendResponse;
import com.procurement.buyer.api.ProcurementAnalyticsResponse;
import com.procurement.buyer.api.CategorySpendResponse;
import com.procurement.buyer.api.StatusSliceResponse;
import com.procurement.buyer.api.SupplierSpendResponse;
import com.procurement.buyer.domain.MonthlySpend;
import com.procurement.buyer.domain.StatusSlice;
import com.procurement.buyer.domain.SupplierSpend;
import com.procurement.buyer.domain.ProcurementAnalyticsFilter;
import com.procurement.buyer.api.ProcurementAnalyticsFiltersResponse;
import com.procurement.buyer.api.ProcurementAnalyticsMetadataResponse;
import com.procurement.buyer.infrastructure.BuyerAnalyticsMapper;
import com.procurement.common.tenant.TenantAccessGuard;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

// 订单金额、当前轮可比报价差额与独立需求估算，所有聚合共享同一只读快照。
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

  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ, propagation = Propagation.REQUIRES_NEW)
  public ProcurementAnalyticsResponse procurementAnalytics() {
    return procurementAnalytics(null, null, null, null);
  }

  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ, propagation = Propagation.REQUIRES_NEW)
  public ProcurementAnalyticsResponse procurementAnalytics(LocalDate fromDate, LocalDate toDate,
      String supplierId, String status) {
    String tenantId = TenantAccessGuard.requireTenantId("analytics APIs");
    permissions.require("buyer:analytics:read");
    var scope = scopes.currentUserDataScope();
    var filter = ProcurementAnalyticsFilter.resolve(fromDate, toDate, supplierId, status, Clock.systemUTC());
    Instant createdAt = Instant.now();

    var months = analyticsMapper.monthlySpend(tenantId, scope, filter).stream()
        .collect(Collectors.toMap(MonthlySpend::period, Function.identity()));
    List<MonthlySpend> monthly = new ArrayList<>();
    for (YearMonth month = YearMonth.from(filter.fromDate()); !month.isAfter(YearMonth.from(filter.toDate())); month = month.plusMonths(1)) {
      monthly.add(months.getOrDefault(month.toString(), new MonthlySpend(month.toString(), BigDecimal.ZERO, 0)));
    }
    List<SupplierSpend> suppliers = analyticsMapper.supplierSpend(tenantId, scope, filter);
    List<StatusSlice> statuses = analyticsMapper.statusDistribution(tenantId, scope, filter);
    BigDecimal savings = analyticsMapper.biddingSavings(tenantId, scope, filter);
    var categoryResponses = analyticsMapper.categorySpend(tenantId, scope, filter).stream()
        .map(c -> new CategorySpendResponse(c.category(), c.totalAmount())).toList();
    var metadata = new ProcurementAnalyticsMetadataResponse(
        new ProcurementAnalyticsFiltersResponse(filter.fromDate(), filter.toDate(), filter.supplierId(), filter.status()),
        "procurement-analytics-v2", createdAt, "Asia/Shanghai",
        !scope.restricted() ? "本租户全部授权数据" : scope.requesterId() != null ? "本人创建范围" : "授权部门范围（合并询比须全部需求可见）",
        "订单创建日期（Asia/Shanghai，起日含至末日含）；订单金额合计，默认含全部状态及待供应商确认，不代表已付款或扣除退货后的净额。供应商/状态仅缩小已授权订单集合。",
        "筛选订单对应的已定标项目：当前轮已中选报价对应的最新已通过定标，每项目计一次；同轮有效报价（已提交/已中选/未中选，金额大于0）至少两家，最高可比报价减定标金额，下限0；非审计节约额，不除以订单金额。",
        "独立总体：同日期内创建且当前已通过的可见需求，数量×当前物料参考价，属于估算而非历史订单品类金额；不应用订单供应商/状态筛选，不与订单金额对账。缺失物料来源不猜测分摊。");

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
        categoryResponses,
        categoryResponses,
        metadata);
  }
}
