package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.platform.application.BillingApplicationService;
import com.procurement.platform.api.TenantUsageResponse;
import com.procurement.platform.domain.PlanQuota;
import com.procurement.platform.domain.PlatformTenant;
import com.procurement.platform.domain.SubscriptionPlan;
import com.procurement.platform.infrastructure.PlatformTenantMapper;
import com.procurement.platform.infrastructure.SubscriptionPlanMapper;
import com.procurement.platform.infrastructure.UsageMeteringMapper;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

// 平台计费:用量超配额计费 = 月基础费 + Σ 超额 × 超额单价。
class BillingApplicationServiceTests {

  private final PlatformTenantMapper tenantMapper = mock(PlatformTenantMapper.class);
  private final SubscriptionPlanMapper planMapper = mock(SubscriptionPlanMapper.class);
  private final UsageMeteringMapper meteringMapper = mock(UsageMeteringMapper.class);
  private final com.procurement.platform.infrastructure.BillingStatementMapper statementMapper =
      mock(com.procurement.platform.infrastructure.BillingStatementMapper.class);
  private final com.procurement.platform.infrastructure.BillingStatementLineMapper statementLineMapper =
      mock(com.procurement.platform.infrastructure.BillingStatementLineMapper.class);
  private final BillingApplicationService service =
      new BillingApplicationService(
          tenantMapper, planMapper, meteringMapper, statementMapper, statementLineMapper);

  @Test
  void computesOverageAndTotalBill() {
    when(tenantMapper.findById("tenant-acme"))
        .thenReturn(new PlatformTenant("tenant-acme", "Acme", "MVP", "active", "[]", 3));
    when(planMapper.findPlan("MVP"))
        .thenReturn(new SubscriptionPlan("MVP", "入门版", new BigDecimal("999.00")));
    when(planMapper.listQuotas("MVP"))
        .thenReturn(List.of(
            new PlanQuota("MVP", "orders", 3, new BigDecimal("50.00")),
            new PlanQuota("MVP", "invoices", 5, new BigDecimal("30.00")),
            new PlanQuota("MVP", "rfqs", 5, new BigDecimal("20.00")),
            new PlanQuota("MVP", "users", 3, new BigDecimal("100.00"))));
    when(meteringMapper.countOrders("tenant-acme")).thenReturn(5); // 超 2
    when(meteringMapper.countInvoices("tenant-acme")).thenReturn(4); // 未超
    when(meteringMapper.countRfqs("tenant-acme")).thenReturn(6); // 超 1
    when(meteringMapper.countActiveUsers("tenant-acme")).thenReturn(3); // 未超

    TenantUsageResponse usage = service.usageForTenant("tenant-acme");

    assertThat(usage.lines()).hasSize(4);
    var orders = usage.lines().stream().filter(l -> l.metric().equals("orders")).findFirst().orElseThrow();
    assertThat(orders.overage()).isEqualTo(2);
    assertThat(orders.overageCost()).isEqualByComparingTo("100.00");
    var invoices = usage.lines().stream().filter(l -> l.metric().equals("invoices")).findFirst().orElseThrow();
    assertThat(invoices.overage()).isZero();
    // 超额合计 = 2×50 + 1×20 = 120;应付 = 999 + 120 = 1119。
    assertThat(usage.overageTotal()).isEqualByComparingTo("120.00");
    assertThat(usage.totalBill()).isEqualByComparingTo("1119.00");
  }

  private void stubUsage() {
    when(tenantMapper.findById("tenant-acme"))
        .thenReturn(new PlatformTenant("tenant-acme", "Acme", "MVP", "active", "[]", 3));
    when(planMapper.findPlan("MVP"))
        .thenReturn(new SubscriptionPlan("MVP", "入门版", new BigDecimal("999.00")));
    when(planMapper.listQuotas("MVP"))
        .thenReturn(List.of(new PlanQuota("MVP", "orders", 3, new BigDecimal("50.00"))));
    when(meteringMapper.countOrders("tenant-acme")).thenReturn(5);
  }

  @Test
  void generateStatementSnapshotsUsageAsDraftWhenNoneExists() {
    stubUsage();
    when(statementMapper.findByTenantAndPeriod("tenant-acme", "2026-06")).thenReturn(null);
    when(statementMapper.findByTenantAndId(org.mockito.ArgumentMatchers.eq("tenant-acme"),
            org.mockito.ArgumentMatchers.anyString()))
        .thenReturn(new com.procurement.platform.domain.BillingStatement(
            "stmt-1", "tenant-acme", "2026-06", "MVP", new BigDecimal("999.00"),
            new BigDecimal("100.00"), new BigDecimal("1099.00"), "草稿", null, null, null));

    var stmt = service.generateStatement("tenant-acme", "2026-06");

    verify(statementMapper).insert(org.mockito.ArgumentMatchers.startsWith("stmt-"),
        org.mockito.ArgumentMatchers.eq("tenant-acme"), org.mockito.ArgumentMatchers.eq("2026-06"),
        org.mockito.ArgumentMatchers.eq("MVP"), org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.eq("草稿"));
    assertThat(stmt.status()).isEqualTo("草稿");
  }

  @Test
  void generateStatementIsIdempotentWhenPeriodExists() {
    when(statementMapper.findByTenantAndPeriod("tenant-acme", "2026-06"))
        .thenReturn(new com.procurement.platform.domain.BillingStatement(
            "stmt-1", "tenant-acme", "2026-06", "MVP", new BigDecimal("999.00"),
            new BigDecimal("100.00"), new BigDecimal("1099.00"), "已开票", null, null, null));

    var stmt = service.generateStatement("tenant-acme", "2026-06");

    assertThat(stmt.status()).isEqualTo("已开票");
    verify(statementMapper, org.mockito.Mockito.never()).insert(
        org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString(),
        org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
        org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyString());
  }

  @Test
  void issueOnlyFromDraftAndPayOnlyFromIssued() {
    when(statementMapper.markIssued("tenant-acme", "stmt-x", "草稿", "已开票")).thenReturn(0);
    org.assertj.core.api.Assertions.assertThatThrownBy(
            () -> service.issueStatement("tenant-acme", "stmt-x"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("草稿");

    when(statementMapper.markPaid("tenant-acme", "stmt-y", "已开票", "已结清")).thenReturn(0);
    org.assertj.core.api.Assertions.assertThatThrownBy(
            () -> service.payStatement("tenant-acme", "stmt-y"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("已开票");
  }
}
