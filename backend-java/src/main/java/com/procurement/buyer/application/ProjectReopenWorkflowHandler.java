package com.procurement.buyer.application;

import com.procurement.workflow.application.*;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import org.springframework.stereotype.Component;

@Component
public record ProjectReopenWorkflowHandler(ProjectReopenService service)
    implements WorkflowBusinessCompletionHandler {
  public String businessType() {
    return "project_reopen";
  }

  public boolean requiresIndependentApprover() {
    return true;
  }

  public void validateTask(WorkflowBusinessInstance i, boolean approved) {
    service.validate(i, approved);
  }

  public void onCompleted(WorkflowBusinessInstance i, WorkflowCompletion c) {
    service.complete(i, c);
  }

  public void onCancelled(WorkflowBusinessInstance i, String actor, String reason) {
    service.cancel(i, actor);
  }
}
