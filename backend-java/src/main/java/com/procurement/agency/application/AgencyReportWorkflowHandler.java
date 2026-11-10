package com.procurement.agency.application;

import com.procurement.workflow.application.*;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import org.springframework.stereotype.Component;

@Component
public record AgencyReportWorkflowHandler(AgencyReportProjector projector)
    implements WorkflowBusinessCompletionHandler {
  public String businessType() {
    return "agency_evaluation_report";
  }

  public boolean requiresIndependentApprover() {
    return true;
  }

  public void validateTask(WorkflowBusinessInstance i, boolean approved) {
    projector.validate(i, approved);
  }

  public void onCompleted(WorkflowBusinessInstance i, WorkflowCompletion c) {
    projector.complete(i, c.approved() ? "approved" : "rejected", c.actorId(), c.comment());
  }

  public void onCancelled(WorkflowBusinessInstance i, String actor, String reason) {
    projector.complete(i, "withdrawn", actor, reason);
  }
}
