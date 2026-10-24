package com.procurement.buyer.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.buyer.infrastructure.BudgetLifecycleMapper;
import com.procurement.buyer.infrastructure.DepartmentBudgetMapper;
import com.procurement.workflow.application.WorkflowBusinessCompletionHandler;
import com.procurement.workflow.application.WorkflowCompletion;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import org.springframework.stereotype.Component;

@Component
public class BudgetChangeWorkflowHandler implements WorkflowBusinessCompletionHandler {
  protected final BudgetLifecycleMapper mapper;
  private final DepartmentBudgetMapper budgets;
  private final BudgetControlService control;
  private final AuditLogApplicationService audit;
  private com.procurement.notification.application.NotificationApplicationService notifications;
  @org.springframework.beans.factory.annotation.Autowired
  void setNotifications(com.procurement.notification.application.NotificationApplicationService notifications) { this.notifications=notifications; }
  public BudgetChangeWorkflowHandler(BudgetLifecycleMapper mapper,DepartmentBudgetMapper budgets,
      BudgetControlService control,AuditLogApplicationService audit) {
    this.mapper=mapper;this.budgets=budgets;this.control=control;this.audit=audit;
  }
  @Override public String businessType() { return "budget_change"; }
  @Override public boolean requiresIndependentApprover() { return true; }
  @Override public void onCompleted(WorkflowBusinessInstance instance,WorkflowCompletion completion) {
    mapper.lockTenant(instance.tenantId());var request=mapper.find(instance.tenantId(),instance.businessId());
    if(request==null || !"submitted".equals(request.status()) || !instance.id().equals(request.workflowInstanceId())) {
      throw new IllegalStateException("预算申请不在对应审批中");
    }
    if(completion.approved()) {
      if(request.createdBy().equals(completion.actorId())) throw new IllegalStateException("预算申请与审批须职责分离，请由其他有权审批人办理");
      if(!mapper.activeDepartment(instance.tenantId(),request.departmentId())) throw new IllegalStateException("预算所属部门已停用，请驳回后核对");
      var current=mapper.total(instance.tenantId(),request.departmentId(),request.period());
      if(mapper.version(instance.tenantId(),request.departmentId(),request.period())!=request.baseVersion()
          || (current==null ? java.math.BigDecimal.ZERO : current).compareTo(request.baseAmount())!=0) {
        throw new IllegalStateException("预算基线已变化，请驳回后重新发起，不能覆盖新版本");
      }
      if(!"exception".equals(request.kind())) {
        var occupied=control.position(instance.tenantId(),request.departmentId(),request.period()).occupied();
        if(!"warning".equals(mapper.mode(instance.tenantId())) && request.targetAmount().compareTo(occupied)<0) {
          throw new IllegalStateException("调整后额度低于已有占用，当前强控制模式不允许生效");
        }
        String existing=budgets.findId(instance.tenantId(),request.departmentId(),request.period());
        budgets.upsert(existing==null?"budget-"+java.util.UUID.randomUUID():existing,instance.tenantId(),request.departmentId(),request.period(),request.targetAmount());
        mapper.incrementVersion(instance.tenantId(),request.departmentId(),request.period());
      }
      if(mapper.approve(instance.tenantId(),request.id(),completion.actorId())!=1) throw new IllegalStateException("预算申请已处理");
    } else if(mapper.status(instance.tenantId(),request.id(),"submitted","rejected")!=1) throw new IllegalStateException("预算申请已处理");
    audit.recordTenantAction(instance.tenantId(),completion.approved()?"budget.request_approved":"budget.request_rejected",
        "budget_request",request.id(),completion.comment());
    if(notifications!=null) notifications.notifyTenantUsers(instance.tenantId(),java.util.List.of(request.createdBy()),
        completion.approved()?"预算申请已通过":"预算申请已驳回",request.title()+"："+(completion.approved()?"审批通过":"请查看审批意见后重新申请"));
  }
  @Override public void onCancelled(WorkflowBusinessInstance instance,String actorId,String reason) {
    var request=mapper.find(instance.tenantId(),instance.businessId());
    if(request==null || !instance.id().equals(request.workflowInstanceId()) || mapper.status(instance.tenantId(),request.id(),"submitted","withdrawn")!=1) {
      throw new IllegalStateException("预算申请状态已变化，不能撤回");
    }
  }
}
