package com.procurement.platform.application;

import com.procurement.platform.api.TenantUsageResponse;
import com.procurement.platform.api.UsageLineResponse;
import com.procurement.platform.domain.PlanQuota;
import com.procurement.platform.domain.PlatformTenant;
import com.procurement.platform.domain.SubscriptionPlan;
import com.procurement.platform.infrastructure.PlatformTenantMapper;
import com.procurement.platform.infrastructure.SubscriptionPlanMapper;
import com.procurement.platform.infrastructure.UsageMeteringMapper;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

// 平台计费:计量租户各项实际用量,对照套餐配额计算超额与应付账单。
@Service
public class BillingApplicationService {

  // 计量项展示标签(顺序即展示顺序)。
  private static final Map<String, String> METRIC_LABELS = new LinkedHashMap<>();

  static {
    METRIC_LABELS.put("orders", "采购订单");
    METRIC_LABELS.put("invoices", "发票");
    METRIC_LABELS.put("rfqs", "询价项目");
    METRIC_LABELS.put("users", "成员账号");
  }

  private final PlatformTenantMapper platformTenantMapper;
  private final SubscriptionPlanMapper subscriptionPlanMapper;
  private final UsageMeteringMapper usageMeteringMapper;

  public BillingApplicationService(
      PlatformTenantMapper platformTenantMapper,
      SubscriptionPlanMapper subscriptionPlanMapper,
      UsageMeteringMapper usageMeteringMapper) {
    this.platformTenantMapper = platformTenantMapper;
    this.subscriptionPlanMapper = subscriptionPlanMapper;
    this.usageMeteringMapper = usageMeteringMapper;
  }

  public TenantUsageResponse usageForTenant(String tenantId) {
    PlatformTenant tenant = platformTenantMapper.findById(tenantId);
    if (tenant == null) {
      throw new IllegalArgumentException("Tenant not found: " + tenantId);
    }
    SubscriptionPlan plan = subscriptionPlanMapper.findPlan(tenant.plan());
    String planName = plan == null ? tenant.plan() : plan.name();
    BigDecimal basePrice = plan == null ? BigDecimal.ZERO : plan.monthlyBasePrice();

    Map<String, PlanQuota> quotaByMetric = new LinkedHashMap<>();
    for (PlanQuota quota : subscriptionPlanMapper.listQuotas(tenant.plan())) {
      quotaByMetric.put(quota.metric(), quota);
    }

    Map<String, Integer> usage = meterUsage(tenantId);
    List<UsageLineResponse> lines = new ArrayList<>();
    BigDecimal overageTotal = BigDecimal.ZERO;
    for (Map.Entry<String, String> entry : METRIC_LABELS.entrySet()) {
      String metric = entry.getKey();
      PlanQuota quota = quotaByMetric.get(metric);
      int included = quota == null ? 0 : quota.includedQuota();
      BigDecimal unitPrice = quota == null ? BigDecimal.ZERO : quota.overageUnitPrice();
      int used = usage.getOrDefault(metric, 0);
      int overage = Math.max(0, used - included);
      BigDecimal overageCost = unitPrice.multiply(BigDecimal.valueOf(overage));
      overageTotal = overageTotal.add(overageCost);
      lines.add(
          new UsageLineResponse(
              metric, entry.getValue(), included, used, overage, unitPrice, overageCost));
    }

    return new TenantUsageResponse(
        tenant.id(),
        tenant.name(),
        tenant.plan(),
        planName,
        basePrice,
        lines,
        overageTotal,
        basePrice.add(overageTotal));
  }

  private Map<String, Integer> meterUsage(String tenantId) {
    Map<String, Integer> usage = new LinkedHashMap<>();
    usage.put("orders", usageMeteringMapper.countOrders(tenantId));
    usage.put("invoices", usageMeteringMapper.countInvoices(tenantId));
    usage.put("rfqs", usageMeteringMapper.countRfqs(tenantId));
    usage.put("users", usageMeteringMapper.countActiveUsers(tenantId));
    return usage;
  }
}
