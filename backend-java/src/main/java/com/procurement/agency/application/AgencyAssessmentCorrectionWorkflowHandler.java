package com.procurement.agency.application;

import com.procurement.workflow.application.*;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import org.springframework.stereotype.Component;

@Component
public record AgencyAssessmentCorrectionWorkflowHandler(
    AgencyAssessmentCorrectionProjector projector, AgencyFinalResponseCorrectionProjector finals)
    implements WorkflowBusinessCompletionHandler {
  public String businessType() {
    return "agency_assessment_correction";
  }

  public boolean requiresIndependentApprover() {
    return true;
  }

  public void validateTask(WorkflowBusinessInstance i, boolean approved) {
    if (finals.handles(i)) finals.validate(i);
    else projector.validate(i);
  }

  public void onCompleted(WorkflowBusinessInstance i, WorkflowCompletion c) {
    if (finals.handles(i))
      finals.complete(i, c.approved() ? "approved" : "rejected", c.actorId(), c.comment());
    else projector.complete(i, c.approved() ? "approved" : "rejected", c.actorId(), c.comment());
  }

  public void onCancelled(WorkflowBusinessInstance i, String actor, String reason) {
    if (finals.handles(i)) finals.complete(i, "withdrawn", actor, reason);
    else projector.complete(i, "withdrawn", actor, reason);
  }
}
