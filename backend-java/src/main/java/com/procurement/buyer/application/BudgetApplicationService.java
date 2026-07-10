package com.procurement.buyer.application;

import com.procurement.buyer.api.DepartmentBudgetResponse;
import com.procurement.buyer.api.UpsertDepartmentBudgetRequest;
import com.procurement.buyer.domain.DepartmentBudget;
import com.procurement.buyer.infrastructure.DepartmentBudgetMapper;
import com.procurement.common.tenant.TenantAccessGuard;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;

// 预算管理:部门预算池 + 需求占用(已用/在途)→ 剩余/占用率/超预算预警。
@Service
public class BudgetApplicationService {
  private final DepartmentBudgetMapper budgetMapper;

  public BudgetApplicationService(DepartmentBudgetMapper budgetMapper) {
    this.budgetMapper = budgetMapper;
  }

  public List<DepartmentBudgetResponse> listBudgets() {
    String tenantId = TenantAccessGuard.requireTenantId("budget APIs");
    return budgetMapper.listByTenant(tenantId).stream().map(this::toResponse).toList();
  }

  public DepartmentBudgetResponse upsertBudget(UpsertDepartmentBudgetRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("budget APIs");
    String existingId =
        budgetMapper.findId(tenantId, request.departmentId(), request.period());
    String id = existingId != null ? existingId : "budget-" + UUID.randomUUID();
    budgetMapper.upsert(
        id, tenantId, request.departmentId(), request.period(), request.totalAmount());
    return toResponse(budgetMapper.findByTenantAndId(tenantId, id));
  }

  private DepartmentBudgetResponse toResponse(DepartmentBudget b) {
    BigDecimal total = b.totalAmount() == null ? BigDecimal.ZERO : b.totalAmount();
    BigDecimal committed = b.committed() == null ? BigDecimal.ZERO : b.committed();
    BigDecimal pending = b.pending() == null ? BigDecimal.ZERO : b.pending();
    BigDecimal disbursed = b.disbursed() == null ? BigDecimal.ZERO : b.disbursed();
    BigDecimal occupied = committed.add(pending);
    BigDecimal remaining = total.subtract(occupied);
    Integer occupancyPercent =
        total.compareTo(BigDecimal.ZERO) > 0
            ? occupied.multiply(BigDecimal.valueOf(100)).divide(total, 0, RoundingMode.HALF_UP).intValue()
            : null;
    boolean overBudget = occupied.compareTo(total) > 0;
    return new DepartmentBudgetResponse(
        b.id(),
        b.departmentId(),
        b.departmentName(),
        b.period(),
        total,
        committed,
        pending,
        remaining,
        occupancyPercent,
        overBudget,
        disbursed);
  }
}
