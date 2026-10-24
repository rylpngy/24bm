package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.buyer.api.DepartmentBudgetResponse;
import com.procurement.buyer.api.UpsertDepartmentBudgetRequest;
import com.procurement.buyer.application.BudgetApplicationService;
import com.procurement.buyer.domain.DepartmentBudget;
import com.procurement.buyer.infrastructure.DepartmentBudgetMapper;
import com.procurement.common.tenant.TenantContext;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

// 预算占用口径:已用=已通过需求,在途=审批中需求;剩余/占用率/超预算预警。
class BudgetApplicationServiceTests {

  private final DepartmentBudgetMapper mapper = mock(DepartmentBudgetMapper.class);
  private final BudgetApplicationService service = new BudgetApplicationService(mapper,
      mock(com.procurement.identity.application.PermissionService.class), TestDataScopes.unrestricted(),
      mock(com.procurement.audit.application.AuditLogApplicationService.class));

  @org.junit.jupiter.api.BeforeEach
  void allowTestDepartments() {
    when(mapper.activeDepartmentExists(any(), any())).thenReturn(true);
  }

  @AfterEach
  void clear() {
    TenantContext.clear();
  }

  @Test
  void computesRemainingOccupancyAndOverBudgetFlag() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(mapper.listByTenant("tenant-1", com.procurement.identity.domain.DataScope.unrestricted())).thenReturn(List.of(
        new DepartmentBudget(
            "budget-it-2026", "dept-it", "信息化部", "2026",
            new BigDecimal("480000"), new BigDecimal("458000"), new BigDecimal("36000"), new java.math.BigDecimal("0")),
        new DepartmentBudget(
            "budget-fin-2026", "dept-finance", "财务部", "2026",
            new BigDecimal("200000"), BigDecimal.ZERO, BigDecimal.ZERO, new java.math.BigDecimal("0"))));

    List<DepartmentBudgetResponse> budgets = service.listBudgets();

    DepartmentBudgetResponse it = budgets.get(0);
    // 占用 458000 + 36000 = 494000 > 480000 → 超预算,剩余 -14000,占用率 103%
    assertThat(it.remaining()).isEqualByComparingTo("-14000");
    assertThat(it.occupancyPercent()).isEqualTo(103);
    assertThat(it.overBudget()).isTrue();

    DepartmentBudgetResponse fin = budgets.get(1);
    assertThat(fin.remaining()).isEqualByComparingTo("200000");
    assertThat(fin.occupancyPercent()).isEqualTo(0);
    assertThat(fin.overBudget()).isFalse();
  }

  @Test
  void zeroBudgetYieldsNullOccupancyPercent() {
    TenantContext.set("tenant-1", null, "buyer-user");
    when(mapper.listByTenant("tenant-1", com.procurement.identity.domain.DataScope.unrestricted())).thenReturn(List.of(
        new DepartmentBudget(
            "budget-zero", "dept-x", "X部", "2026",
            BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, new java.math.BigDecimal("0"))));

    DepartmentBudgetResponse r = service.listBudgets().get(0);

    assertThat(r.occupancyPercent()).isNull();
    assertThat(r.overBudget()).isFalse();
  }

  @Test
  void upsertReusesExistingIdWhenPresent() {
    TenantContext.set("tenant-1", null, "buyer-user");
    org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.upsertBudget(
        new UpsertDepartmentBudgetRequest("dept-it", "2026", new BigDecimal("500000"))))
        .hasMessageContaining("提交审批");
    org.mockito.Mockito.verify(mapper,org.mockito.Mockito.never()).upsert(any(),any(),any(),any(),any());
  }

  @Test
  void upsertGeneratesIdWhenNew() {
    TenantContext.set("tenant-1", null, "buyer-user");
    org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.upsertBudget(
        new UpsertDepartmentBudgetRequest("dept-new", "2026", new BigDecimal("100000"))))
        .hasMessageContaining("提交审批");
    org.mockito.Mockito.verify(mapper,org.mockito.Mockito.never()).upsert(any(),any(),any(),any(),any());
  }
}
