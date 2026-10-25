package com.procurement.buyer.application;

import com.procurement.workflow.application.*;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import org.springframework.stereotype.Component;

@Component
public record ProjectCarryoverWorkflowHandler(ProjectLifecycleService service)
    implements WorkflowBusinessCompletionHandler {
  public String businessType() {
    return "project_carryover";
  }

  public boolean requiresIndependentApprover() {
    return true;
  }

  public void validateTask(WorkflowBusinessInstance i, boolean a) {
    service.validate(i, a);
  }

  public void onCompleted(WorkflowBusinessInstance i, WorkflowCompletion c) {
    service.complete(i, c);
  }

  public void onCancelled(WorkflowBusinessInstance i, String a, String r) {
    service.cancel(i, a);
  }
}
