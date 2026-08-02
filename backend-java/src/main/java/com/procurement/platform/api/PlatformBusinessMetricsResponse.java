package com.procurement.platform.api;

import java.math.BigDecimal;
import java.util.List;

/**
 * 平台经营看板(D-1):跨租户真实聚合,仅供平台运营端只读。
 * 交易规模按采购订单与合同金额统计;活跃度按近 30 天有业务动作的租户计;
 * 采购方式分布按 RFQ method(招标经锚点 RFQ 计入「招标」)。
 */
public record PlatformBusinessMetricsResponse(
    // 累计交易:订单笔数与金额、合同笔数与金额
    long orderCount,
    BigDecimal orderAmount,
    long contractCount,
    BigDecimal contractAmount,
    // 近 30 天:新增订单与金额、活跃租户(有订单/项目动作)
    long recentOrderCount,
    BigDecimal recentOrderAmount,
    long activeTenantCount,
    // 供应商生态:认证供应商、近 30 天新增
    long verifiedSupplierCount,
    long recentSupplierCount,
    // 采购方式分布(项目数)与近 6 个月趋势
    List<MethodShare> methodShares,
    List<MonthlyTrend> monthlyTrends) {

  public record MethodShare(String method, long projectCount, BigDecimal orderAmount) {}

  public record MonthlyTrend(String month, long orderCount, BigDecimal orderAmount, long newTenantCount) {}
}
