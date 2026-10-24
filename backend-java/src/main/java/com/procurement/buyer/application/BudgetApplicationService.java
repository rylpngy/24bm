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
  private final com.procurement.identity.application.PermissionService permissions;
  private final com.procurement.identity.application.DataScopeService scopes;
  private final com.procurement.audit.application.AuditLogApplicationService audit;
  private BudgetControlService control;

  @org.springframework.beans.factory.annotation.Autowired
  void setBudgetControlService(BudgetControlService control) { this.control=control; }

  public BudgetApplicationService(DepartmentBudgetMapper budgetMapper,
      com.procurement.identity.application.PermissionService permissions,
      com.procurement.identity.application.DataScopeService scopes,
      com.procurement.audit.application.AuditLogApplicationService audit) {
    this.budgetMapper = budgetMapper;
    this.permissions = permissions;
    this.scopes = scopes;
    this.audit = audit;
  }

  @org.springframework.transaction.annotation.Transactional(readOnly=true,isolation=org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
  public List<DepartmentBudgetResponse> listBudgets() {
    String tenantId = TenantAccessGuard.requireTenantId("budget APIs");
    permissions.require("buyer:budget:read");
    return budgetMapper.listByTenant(tenantId, scopes.currentUserDataScope()).stream().map(this::toResponse).toList();
  }

  @org.springframework.transaction.annotation.Transactional
  public DepartmentBudgetResponse upsertBudget(UpsertDepartmentBudgetRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("budget APIs");
    permissions.require("buyer:budget:manage");
    var scope=scopes.currentUserDataScope();
    if(scope.restricted() && (scope.requesterId()!=null || !scope.departmentIds().contains(request.departmentId()))) {
      throw new com.procurement.common.tenant.PermissionDeniedException("当前数据范围不允许维护该部门预算");
    }
    if(!budgetMapper.activeDepartmentExists(tenantId,request.departmentId())) throw new IllegalArgumentException("请选择本企业有效部门");
    throw new IllegalStateException("直接修改生效预算已停用，请在预算编制/调整中创建申请并提交审批");
  }

  private DepartmentBudgetResponse toResponse(DepartmentBudget b) {
    BigDecimal total = b.totalAmount() == null ? BigDecimal.ZERO : b.totalAmount();
    BigDecimal committed = b.committed() == null ? BigDecimal.ZERO : b.committed();
    BigDecimal pending = b.pending() == null ? BigDecimal.ZERO : b.pending();
    BigDecimal disbursed = b.disbursed();
    if(control!=null) {
      var position=control.position(com.procurement.common.tenant.TenantAccessGuard.requireTenantId("budget APIs"),b.departmentId(),b.period());
      committed=position.committed();pending=position.pending();disbursed=position.paidAmount();
    }
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
        disbursed,
        b.pendingAllocationAmount(),
        b.unverifiedPaymentCount());
  }
}
