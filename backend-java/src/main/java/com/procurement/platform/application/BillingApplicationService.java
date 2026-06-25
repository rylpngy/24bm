package com.procurement.platform.application;

import com.procurement.platform.api.BillingStatementResponse;
import com.procurement.platform.api.TenantUsageResponse;
import com.procurement.platform.api.UsageLineResponse;
import com.procurement.platform.domain.BillingStatement;
import com.procurement.platform.domain.BillingStatementLine;
import com.procurement.platform.domain.BillingStatementStatus;
import com.procurement.platform.domain.PlanQuota;
import com.procurement.platform.domain.PlatformTenant;
import com.procurement.platform.domain.SubscriptionPlan;
import com.procurement.platform.infrastructure.BillingStatementLineMapper;
import com.procurement.platform.infrastructure.BillingStatementMapper;
import com.procurement.platform.infrastructure.PlatformTenantMapper;
import com.procurement.platform.infrastructure.SubscriptionPlanMapper;
import com.procurement.platform.infrastructure.UsageMeteringMapper;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

  private static final DateTimeFormatter PERIOD_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM");
  private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Shanghai");

  private final PlatformTenantMapper platformTenantMapper;
  private final SubscriptionPlanMapper subscriptionPlanMapper;
  private final UsageMeteringMapper usageMeteringMapper;
  private final BillingStatementMapper billingStatementMapper;
  private final BillingStatementLineMapper billingStatementLineMapper;

  public BillingApplicationService(
      PlatformTenantMapper platformTenantMapper,
      SubscriptionPlanMapper subscriptionPlanMapper,
      UsageMeteringMapper usageMeteringMapper,
      BillingStatementMapper billingStatementMapper,
      BillingStatementLineMapper billingStatementLineMapper) {
    this.platformTenantMapper = platformTenantMapper;
    this.subscriptionPlanMapper = subscriptionPlanMapper;
    this.usageMeteringMapper = usageMeteringMapper;
    this.billingStatementMapper = billingStatementMapper;
    this.billingStatementLineMapper = billingStatementLineMapper;
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

  // 生成当期账单:对用量计费做快照落库(头 + 行)。幂等——同期已存在则直接返回。
  @Transactional
  public BillingStatementResponse generateStatement(String tenantId, String period) {
    String effectivePeriod =
        period == null || period.isBlank()
            ? LocalDate.now(BUSINESS_ZONE).format(PERIOD_FORMAT)
            : period;
    BillingStatement existing =
        billingStatementMapper.findByTenantAndPeriod(tenantId, effectivePeriod);
    if (existing != null) {
      return toStatementResponse(existing);
    }

    TenantUsageResponse usage = usageForTenant(tenantId);
    String statementId = "stmt-" + UUID.randomUUID();
    billingStatementMapper.insert(
        statementId,
        tenantId,
        effectivePeriod,
        usage.planCode(),
        usage.monthlyBasePrice(),
        usage.overageTotal(),
        usage.totalBill(),
        BillingStatementStatus.DRAFT);
    int sortNo = 0;
    for (UsageLineResponse line : usage.lines()) {
      billingStatementLineMapper.insert(
          "stmtl-" + UUID.randomUUID(),
          statementId,
          line.metric(),
          line.label(),
          line.includedQuota(),
          line.used(),
          line.overage(),
          line.overageUnitPrice(),
          line.overageCost(),
          sortNo++);
    }
    return toStatementResponse(billingStatementMapper.findByTenantAndId(tenantId, statementId));
  }

  public List<BillingStatementResponse> listStatements(String tenantId) {
    return billingStatementMapper.listByTenant(tenantId).stream()
        .map(this::toStatementResponse)
        .toList();
  }

  // 开票:草稿 → 已开票。
  @Transactional
  public BillingStatementResponse issueStatement(String tenantId, String statementId) {
    int updated =
        billingStatementMapper.markIssued(
            tenantId, statementId, BillingStatementStatus.DRAFT, BillingStatementStatus.ISSUED);
    if (updated == 0) {
      throw new IllegalStateException("只有草稿账单可以开票:" + statementId);
    }
    return toStatementResponse(billingStatementMapper.findByTenantAndId(tenantId, statementId));
  }

  // 收款:已开票 → 已结清。
  @Transactional
  public BillingStatementResponse payStatement(String tenantId, String statementId) {
    int updated =
        billingStatementMapper.markPaid(
            tenantId, statementId, BillingStatementStatus.ISSUED, BillingStatementStatus.PAID);
    if (updated == 0) {
      throw new IllegalStateException("只有已开票账单可以登记收款:" + statementId);
    }
    return toStatementResponse(billingStatementMapper.findByTenantAndId(tenantId, statementId));
  }

  private BillingStatementResponse toStatementResponse(BillingStatement s) {
    List<UsageLineResponse> lines =
        billingStatementLineMapper.listByStatement(s.id()).stream()
            .map(
                (BillingStatementLine l) ->
                    new UsageLineResponse(
                        l.metric(),
                        l.label(),
                        l.includedQuota(),
                        l.used(),
                        l.overage(),
                        l.overageUnitPrice(),
                        l.overageCost()))
            .toList();
    return new BillingStatementResponse(
        s.id(),
        s.tenantId(),
        s.period(),
        s.planCode(),
        s.basePrice(),
        s.overageTotal(),
        s.totalAmount(),
        s.status(),
        s.generatedAt(),
        s.issuedAt(),
        s.paidAt(),
        lines);
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
