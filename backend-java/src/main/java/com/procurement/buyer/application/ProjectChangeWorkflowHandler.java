package com.procurement.buyer.application;

import com.procurement.buyer.api.ProjectContracts.Draft;
import com.procurement.buyer.infrastructure.*;
import com.procurement.workflow.application.*;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import org.springframework.stereotype.Component;

@Component
public record ProjectChangeWorkflowHandler(
    ProcurementProjectMapper projects,
    ProjectExpansionMapper changes,
    ProjectAllocationPolicy policy,
    ProjectPlanSupport plans)
    implements WorkflowBusinessCompletionHandler {
  public String businessType() {
    return "project_change";
  }

  public boolean requiresIndependentApprover() {
    return true;
  }

  public void validateTask(WorkflowBusinessInstance instance, boolean approved) {
    var c = changes.change(instance.tenantId(), instance.businessId());
    if (c == null
        || !"submitted".equals(c.status())
        || !instance.id().equals(c.workflowInstanceId()))
      throw new IllegalStateException("变更不在对应审批中");
    if (approved) {
      var p = projects.find(instance.tenantId(), c.projectId());
      if (!"approved".equals(p.status()) || p.revision() != c.basedRevision())
        throw new IllegalStateException("立项基线已变化，请驳回后重新申请");
      policy.validateChange(
          p, policy.read(policy.tree(c.proposal()).path("plan").toString(), Draft.class));
    }
  }

  public void onCompleted(WorkflowBusinessInstance instance, WorkflowCompletion completion) {
    validateTask(instance, completion.approved());
    var c = changes.change(instance.tenantId(), instance.businessId());
    Integer version = null;
    if (completion.approved()) {
      var plan = policy.read(policy.tree(c.proposal()).path("plan").toString(), Draft.class);
      var lines = policy.lines(policy.tree(c.proposal()).path("lines").toString());
      if (changes.apply(
              instance.tenantId(), c.projectId(), c.basedRevision(), plan, plans.total(lines))
          != 1) throw new IllegalStateException("立项基线已变化");
      plans.save(instance.tenantId(), c.projectId(), lines);
      version = c.basedRevision() + 1;
    }
    if (changes.changeState(
            instance.tenantId(),
            c.id(),
            c.revision(),
            completion.approved() ? "approved" : "rejected",
            instance.id(),
            version)
        != 1) throw new IllegalStateException("变更已变化");
  }

  public void onCancelled(WorkflowBusinessInstance instance, String actor, String reason) {
    validateTask(instance, false);
    var c = changes.change(instance.tenantId(), instance.businessId());
    if (changes.changeState(
            instance.tenantId(), c.id(), c.revision(), "withdrawn", instance.id(), null)
        != 1) throw new IllegalStateException("变更已变化");
  }
}
