package com.procurement.buyer.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.buyer.infrastructure.BudgetLifecycleMapper;
import com.procurement.buyer.infrastructure.DepartmentBudgetMapper;
import org.springframework.stereotype.Component;

@Component
public class BudgetExceptionWorkflowHandler extends BudgetChangeWorkflowHandler {
  public BudgetExceptionWorkflowHandler(BudgetLifecycleMapper mapper,DepartmentBudgetMapper budgets,
      BudgetControlService control,AuditLogApplicationService audit) { super(mapper,budgets,control,audit); }
  @Override public String businessType() { return "budget_exception"; }
}
