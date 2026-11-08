package com.procurement.tender.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.tender.infrastructure.TenderDocumentReviewMapper;
import com.procurement.workflow.application.*;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import org.springframework.stereotype.Component;

@Component
public class TenderDocumentReviewHandler implements WorkflowBusinessCompletionHandler {
  private final TenderDocumentReviewMapper reviews;
  private final AuditLogApplicationService audit;
  public TenderDocumentReviewHandler(TenderDocumentReviewMapper reviews,AuditLogApplicationService audit) { this.reviews=reviews;this.audit=audit; }
  public String businessType() { return TenderDocumentReviewService.TYPE; }
  public boolean requiresIndependentApprover() { return true; }
  public void onCompleted(WorkflowBusinessInstance instance,WorkflowCompletion completion) {
    var review=reviews.lock(instance.tenantId(),instance.businessId());
    if(review==null || !review.status().equals("processing")) throw new IllegalStateException("采购文件审查状态已变化");
    if(review.requestedBy().equals(completion.actorId())) throw new IllegalStateException("采购文件审查不可由发起人办理");
    if(reviews.complete(instance.tenantId(),review.id(),completion.approved()?"approved":"rejected",completion.actorId(),completion.comment())!=1)
      throw new IllegalStateException("采购文件审查回写失败");
    audit.recordTenantAction(instance.tenantId(),"tender.document_review."+(completion.approved()?"approved":"rejected"),"tender",review.tenderId(),completion.comment());
  }
}
