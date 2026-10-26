package com.procurement.order.application;

import com.procurement.workflow.application.*;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import org.springframework.stereotype.Component;

@Component
public record OrderSettlementWorkflowHandler(OrderSettlementService service)
    implements WorkflowBusinessCompletionHandler {
  public String businessType() {
    return "order_settlement";
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
}
