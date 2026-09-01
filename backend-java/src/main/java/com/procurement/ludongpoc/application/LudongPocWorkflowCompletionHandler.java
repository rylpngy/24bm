package com.procurement.ludongpoc.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.ludongpoc.infrastructure.LudongPocApplicationMapper;
import com.procurement.workflow.application.WorkflowBusinessCompletionHandler;
import com.procurement.workflow.application.WorkflowCompletion;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import org.springframework.stereotype.Component;

@Component
public class LudongPocWorkflowCompletionHandler implements WorkflowBusinessCompletionHandler {
  private final LudongPocApplicationMapper mapper;
  private final AuditLogApplicationService auditService;

  public LudongPocWorkflowCompletionHandler(
      LudongPocApplicationMapper mapper,
      AuditLogApplicationService auditService) {
    this.mapper = mapper;
    this.auditService = auditService;
  }

  @Override
  public String businessType() {
    return LudongPocWorkflowDefinition.BUSINESS_TYPE;
  }

  @Override
  public void onCompleted(WorkflowBusinessInstance instance, WorkflowCompletion completion) {
    String status = completion.approved() ? "approved" : "rejected";
    if (mapper.complete(instance.tenantId(), instance.businessId(), status) == 0) {
      throw new IllegalStateException("鲁东 POC 申报状态已变化，无法写入流程结果");
    }
    auditService.recordTenantAction(
        instance.tenantId(),
        completion.approved() ? "ludong_poc.approved" : "ludong_poc.rejected",
        "ludong_project_application",
        instance.businessId(),
        completion.comment());
  }
}
