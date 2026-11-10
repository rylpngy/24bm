package com.procurement.agency.application;

import com.procurement.workflow.application.*;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import org.springframework.stereotype.Component;

@Component
public class AgencyArchiveWorkflowHandler implements WorkflowBusinessCompletionHandler {
  private final AgencyReviewProjector projector;

  public AgencyArchiveWorkflowHandler(AgencyReviewProjector projector) {
    this.projector = projector;
  }

  public AgencyReviewProjector projector() {
    return projector;
  }

  public String businessType() {
    return "agency_package_archive";
  }

  public boolean requiresIndependentApprover() {
    return true;
  }

  public void validateTask(WorkflowBusinessInstance instance, boolean approved) {
    projector.validate(instance);
  }

  public void onCompleted(WorkflowBusinessInstance instance, WorkflowCompletion completion) {
    projector.complete(
        instance,
        completion.approved() ? "approved" : "rejected",
        completion.actorId(),
        completion.comment());
  }

  public void onCancelled(WorkflowBusinessInstance instance, String actor, String reason) {
    projector.complete(instance, "withdrawn", actor, reason);
  }
}
