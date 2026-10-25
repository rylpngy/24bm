package com.procurement.buyer.application;

import com.procurement.buyer.infrastructure.ProcurementProjectMapper;
import com.procurement.workflow.application.*;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import org.springframework.stereotype.Component;

@Component
public record ProjectInitiationWorkflowHandler(ProcurementProjectMapper mapper)
    implements WorkflowBusinessCompletionHandler {
  public String businessType() {
    return "project_initiation";
  }

  public boolean requiresIndependentApprover() {
    return true;
  }

  public void validateTask(WorkflowBusinessInstance instance, boolean approved) {
    var p = mapper.find(instance.tenantId(), instance.businessId());
    if (p == null
        || !"submitted".equals(p.status())
        || !instance.id().equals(p.workflowInstanceId()))
      throw new IllegalStateException("项目不在对应审批中");
    if (approved && !mapper.validOwner(instance.tenantId(), p.departmentId(), p.ownerId()))
      throw new IllegalStateException("项目部门或负责人已失效，请驳回核对");
  }

  public void onCompleted(WorkflowBusinessInstance instance, WorkflowCompletion c) {
    validateTask(instance, c.approved());
    var p = mapper.find(instance.tenantId(), instance.businessId());
    if (mapper.state(
            instance.tenantId(),
            p.id(),
            p.revision(),
            c.approved() ? "approved" : "rejected",
            instance.id(),
            c.comment())
        != 1) throw new IllegalStateException("项目状态已变化");
  }

  public void onCancelled(WorkflowBusinessInstance instance, String actor, String reason) {
    validateTask(instance, false);
    var p = mapper.find(instance.tenantId(), instance.businessId());
    if (mapper.state(instance.tenantId(), p.id(), p.revision(), "withdrawn", instance.id(), reason)
        != 1) throw new IllegalStateException("项目状态已变化");
  }
}
