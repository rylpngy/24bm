package com.procurement.ludongpoc.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.ludongpoc.infrastructure.LudongPocApplicationMapper;
import com.procurement.workflow.application.WorkflowReworkService;
import com.procurement.workflow.application.WorkflowBusinessCompletionHandler;
import com.procurement.workflow.application.WorkflowCompletion;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import org.springframework.stereotype.Component;

@Component
public class LudongPocWorkflowCompletionHandler implements WorkflowBusinessCompletionHandler {
  private final LudongPocApplicationMapper mapper;
  private final AuditLogApplicationService auditService;
  private final WorkflowReworkService additionalReviews;

  public LudongPocWorkflowCompletionHandler(
      LudongPocApplicationMapper mapper,
      AuditLogApplicationService auditService, @org.springframework.context.annotation.Lazy WorkflowReworkService additionalReviews) {
    this.mapper = mapper;
    this.auditService = auditService;
    this.additionalReviews = additionalReviews;
  }

  @Override
  public String businessType() {
    return LudongPocWorkflowDefinition.BUSINESS_TYPE;
  }

  @Override
  public boolean requiresBusinessProjection() {
    return true;
  }

  @Override
  public boolean reusesEmployeeDecisions() {
    return true;
  }

  @Override
  public boolean supportsTaskRework() { return true; }

  @Override
  public java.util.List<String> attachmentOwnerTypes() {
    return LudongPocArchiveMaterialCatalog.supported().stream().map(LudongPocArchiveMaterialCatalog.Category::ownerType).toList();
  }

  @Override
  public void onCancelled(WorkflowBusinessInstance instance, String actorId, String reason) {
    if (mapper.complete(instance.tenantId(), instance.businessId(), "draft") != 1) {
      throw new IllegalStateException("申报状态已变化，不能恢复草稿");
    }
    additionalReviews.cancelPendingAdditionalReviews(instance.tenantId(), instance.id());
    auditService.recordTenantAction(instance.tenantId(), "ludong_poc.withdrawn", businessType(), instance.businessId(), reason);
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
