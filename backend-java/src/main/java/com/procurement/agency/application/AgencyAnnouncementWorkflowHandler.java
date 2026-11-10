package com.procurement.agency.application;

import com.procurement.workflow.application.*;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import org.springframework.stereotype.Component;

@Component
public class AgencyAnnouncementWorkflowHandler implements WorkflowBusinessCompletionHandler {
  private final AgencyExecutionWorkflowProjector projector;

  public AgencyAnnouncementWorkflowHandler(AgencyExecutionWorkflowProjector projector) {
    this.projector = projector;
  }

  public String businessType() {
    return "agency_announcement";
  }

  public boolean requiresIndependentApprover() {
    return true;
  }

  public void validateTask(WorkflowBusinessInstance i, boolean approved) {
    projector.validate(i);
  }

  public void onCompleted(WorkflowBusinessInstance i, WorkflowCompletion c) {
    projector.complete(i, c.approved() ? "approved" : "rejected", c.actorId(), c.comment());
  }

  public void onCancelled(WorkflowBusinessInstance i, String actor, String reason) {
    projector.complete(i, "withdrawn", actor, reason);
  }
}
