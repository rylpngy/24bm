package com.procurement.supplier.application;

import com.procurement.supplier.infrastructure.QualificationWorkflowMapper;
import com.procurement.supplier.infrastructure.SupplierQualificationMapper;
import com.procurement.supplier.api.QualificationReviewRequest;
import com.procurement.workflow.application.*;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.identity.application.PermissionService;
import org.springframework.stereotype.Component;

@Component
public class QualificationChangeWorkflowHandler implements WorkflowBusinessCompletionHandler {
  private final QualificationWorkflowMapper mapper;
  private final SupplierQualificationMapper qualifications;
  private final SupplierQualificationApplicationService service;
  private final PermissionService permissions;
  private final AuditLogApplicationService audit;
  public QualificationChangeWorkflowHandler(QualificationWorkflowMapper mapper,SupplierQualificationMapper qualifications,
      SupplierQualificationApplicationService service,PermissionService permissions,AuditLogApplicationService audit){
    this.mapper=mapper;this.qualifications=qualifications;this.service=service;this.permissions=permissions;this.audit=audit;
  }
  @Override public String businessType(){return "supplier_qualification_change";}
  @Override public void validateTask(WorkflowBusinessInstance instance,boolean approved){
    permissions.require("buyer:supplier:read");
    var attempt=mapper.find(instance.tenantId(),instance.businessId());
    if(attempt==null||!"processing".equals(attempt.status())||!instance.id().equals(attempt.workflowInstanceId()))throw new IllegalStateException("资质审批绑定或状态不匹配");
    String supplier=qualifications.reviewSupplier(instance.tenantId(),attempt.reviewId());qualifications.lockSupplier(supplier);
    String qid=qualifications.reviewQualification(instance.tenantId(),attempt.reviewId());var q=qualifications.lockQualification(supplier,qid);
    if(!"pending".equals(mapper.lockReview(attempt.reviewId()))||q==null||!"active".equals(q.status())||qualifications.replacement(supplier,qid)!=null)throw new IllegalStateException("资质已替代、停用或复核已结束，请取消旧流程并核验新版");
    if(approved && q.expiresAt()!=null&&q.expiresAt().isBefore(java.time.LocalDate.now(java.time.ZoneId.of("Asia/Shanghai"))))throw new IllegalStateException("资质已过期，请退回补件");
    if(approved)service.loadObject(q);
  }
  @Override public void onCompleted(WorkflowBusinessInstance instance,WorkflowCompletion completion){
    permissions.require("buyer:supplier:read");
    var attempt=mapper.find(instance.tenantId(),instance.businessId());
    if(attempt==null||!instance.id().equals(attempt.workflowInstanceId())||!"processing".equals(attempt.status()))throw new IllegalStateException("资质审批绑定或状态不匹配");
    qualifications.lockSupplier(qualifications.reviewSupplier(instance.tenantId(),attempt.reviewId()));
    mapper.lockReview(attempt.reviewId());
    service.applyWorkflowReview(attempt.reviewId(),new QualificationReviewRequest(completion.approved(),
        completion.comment()==null||completion.comment().isBlank()?"按流程审核结论办理":completion.comment()));
    String relation=mapper.relation(instance.tenantId(),attempt.reviewId()),qid=qualifications.reviewQualification(instance.tenantId(),attempt.reviewId());
    mapper.settleSupplements(instance.tenantId(),relation,qid,completion.approved()?"closed":"returned");
    if(mapper.finish(instance.tenantId(),attempt.id(),instance.id(),"completed")!=1)throw new IllegalStateException("资质审批已完成");
    audit.recordTenantAction(instance.tenantId(),"qualification.workflow_completed","supplier_qualification",qid,"流程:"+instance.id()+";处理人:"+completion.actorId());
  }
  @Override public void onCancelled(WorkflowBusinessInstance instance,String actor,String reason){
    if(mapper.finish(instance.tenantId(),instance.businessId(),instance.id(),"cancelled")!=1)throw new IllegalStateException("资质审批已结束");
  }
}
