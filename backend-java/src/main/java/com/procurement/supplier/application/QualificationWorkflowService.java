package com.procurement.supplier.application;

import com.procurement.supplier.api.QualificationWorkflowContracts.*;
import com.procurement.supplier.infrastructure.QualificationWorkflowMapper;
import com.procurement.supplier.infrastructure.SupplierQualificationMapper;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.application.PermissionService;
import com.procurement.identity.application.DataScopeService;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.supplier.infrastructure.QualificationNoticeMapper;
import com.procurement.workflow.application.UnifiedWorkflowApplicationService;
import com.procurement.workflow.application.WorkflowStartCommand;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

@Service
public class QualificationWorkflowService {
  private final QualificationWorkflowMapper mapper;
  private final SupplierQualificationMapper qualifications;
  private final SupplierQualificationApplicationService originals;
  private final UnifiedWorkflowApplicationService workflow;
  private final PermissionService permissions;
  private final DataScopeService scopes;
  private final AuditLogApplicationService audit;
  private final QualificationNoticeMapper notices;
  private final NotificationApplicationService notifications;
  public QualificationWorkflowService(QualificationWorkflowMapper mapper,SupplierQualificationMapper qualifications,
      SupplierQualificationApplicationService originals,UnifiedWorkflowApplicationService workflow,PermissionService permissions,
      DataScopeService scopes,AuditLogApplicationService audit,QualificationNoticeMapper notices,NotificationApplicationService notifications) {
    this.mapper=mapper;this.qualifications=qualifications;this.originals=originals;this.workflow=workflow;
    this.permissions=permissions;this.scopes=scopes;this.audit=audit;this.notices=notices;this.notifications=notifications;
  }
  private String buyer(boolean write) { permissions.require("buyer:supplier:"+(write?"manage":"read"));return TenantAccessGuard.requireTenantId("qualification workflow"); }
  private String actor() { return TenantAccessGuard.requireUserId("qualification workflow"); }
  private String relation(String tenant,long review) {
    String relation=mapper.relation(tenant,review);if(relation==null)throw new IllegalArgumentException("资质复核不属于当前企业");return relation;
  }
  private static void page(int page,int size) { if(page<1||size<1||size>100)throw new IllegalArgumentException("页码必须大于0，每页1至100条"); }
  @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
  public AttemptPage history(long review,int page,int size) {
    String tenant=buyer(false);relation(tenant,review);page(page,size);
    // Workflow detail remains protected by its own department/initiator scope.
    var scope=scopes.currentUserDataScope();var items=mapper.history(tenant,review,scope,size,(long)(page-1)*size);
    return new AttemptPage(items,mapper.count(tenant,review,scope),page,size);
  }
  @Transactional
  public Attempt start(long review,StartReview request) {
    String tenant=buyer(true);relation(tenant,review);
    String supplier=qualifications.reviewSupplier(tenant,review);qualifications.lockSupplier(supplier);
    if(!"pending".equals(mapper.lockReview(review))||mapper.active(tenant,review)!=null)throw new IllegalStateException("复核已办理或已有在审流程，请刷新后查看");
    String qid=qualifications.reviewQualification(tenant,review);
    var q=qualifications.lockQualification(supplier,qid);
    if(q==null||qualifications.replacement(supplier,qid)!=null||!"active".equals(q.status()))throw new IllegalStateException("材料已替代或停用，不能发起旧版审批");
    originals.loadObject(q);
    String department=mapper.department(tenant,actor());scopes.requireRecordAccess(department,actor());
    String id="qualification-flow-"+UUID.randomUUID();mapper.create(id,tenant,review,request.reason().strip(),actor());
    var snapshot=new LinkedHashMap<String,Object>();snapshot.put("title",q.qualificationType()+"变更审核");
    snapshot.put("relationId",relation(tenant,review));snapshot.put("supplierId",supplier);snapshot.put("qualificationId",qid);
    snapshot.put("qualificationReviewId",review);snapshot.put("qualificationType",q.qualificationType());
    snapshot.put("certificateNo",q.certificateNo());snapshot.put("expiresAt",q.expiresAt());snapshot.put("fileName",q.fileName());
    snapshot.put("contentSha256",qualifications.originalHash(q.storageKey()));snapshot.put("reason",request.reason().strip());
    var previous=qualifications.reviews(tenant,null).stream().filter(r->r.id()==review).findFirst().orElseThrow();
    snapshot.put("previousId",previous.previousId());snapshot.put("supplierName",previous.supplierName());
    var started=workflow.start(new WorkflowStartCommand("supplier_qualification_change",id,department,null,
        request.formData()==null?Map.of():request.formData(),snapshot));
    if(mapper.bind(tenant,id,started.workflowInstanceId())!=1)throw new IllegalStateException("流程绑定失败");
    audit.recordTenantAction(tenant,"qualification.workflow_started","supplier_qualification",qid,"复核:"+review+";实例:"+started.workflowInstanceId());
    return mapper.find(tenant,id);
  }
  @Transactional public void cancel(String id,String reason) {
    String tenant=buyer(true);var attempt=mapper.find(tenant,id);if(attempt==null)throw new IllegalArgumentException("审批尝试不存在");
    workflow.cancelQualificationReview(attempt.workflowInstanceId(),reason);
  }
  @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
  public SupplementPage supplements(boolean supplier,String relation,int page,int size) {
    page(page,size);String tenant=null,supplierId=null;
    if(supplier){permissions.require("supplier:qualification:read");supplierId=TenantAccessGuard.requireSupplierId("qualification supplement");}
    else tenant=buyer(false);
    return new SupplementPage(mapper.supplements(tenant,supplierId,relation,size,(long)(page-1)*size),mapper.countSupplements(tenant,supplierId,relation),page,size);
  }
  @Transactional public Supplement request(SupplementDraft draft) {
    String tenant=buyer(true);LocalDate today=LocalDate.now(ZoneId.of("Asia/Shanghai"));
    String supplier=mapper.supplier(tenant,draft.relationId());if(supplier==null)throw new IllegalArgumentException("合作关系不存在");qualifications.lockSupplier(supplier);
    if(draft.dueDate().isBefore(today)||draft.dueDate().isAfter(today.plusYears(1)))throw new IllegalArgumentException("补件期限应为今天至一年以内");
    if(!mapper.belongs(tenant,draft.relationId(),draft.qualificationId()))throw new IllegalArgumentException("请选择本企业合作供应商的当前版本资质");
    String id="qualification-supplement-"+UUID.randomUUID();
    try{mapper.requestSupplement(id,tenant,draft.relationId(),draft.qualificationId(),draft.reason().strip(),draft.dueDate(),actor());}
    catch(org.springframework.dao.DuplicateKeyException e){throw new IllegalStateException("该证照已有未完成补件任务，请先处理原任务");}
    var task=mapper.lockSupplement(id);
    notifySupplier(task,"资质补件通知",task.tenantName()+"要求补充"+task.qualificationType()+"，截止"+task.dueDate()+"。原因："+task.reason());
    audit.recordTenantAction(tenant,"qualification.supplement_requested","supplier_qualification",task.qualificationId(),"任务:"+id+";原因:"+task.reason());return task;
  }
  @Transactional public Supplement reply(String id,SupplementReply request) {
    permissions.require("supplier:qualification:manage");String supplier=TenantAccessGuard.requireSupplierId("qualification supplement");
    var found=mapper.supplement(id);if(found==null||!supplier.equals(found.supplierId()))throw new IllegalArgumentException("补件任务不存在或不属于本供应商");
    qualifications.lockSupplier(supplier);var task=mapper.lockSupplement(id);
    var q=qualifications.lockQualification(supplier,request.replacementId());
    if(q==null||!"active".equals(q.status())||!q.qualificationType().equals(task.qualificationType())||!mapper.replacement(supplier,task.qualificationId(),q.id()))throw new IllegalArgumentException("请先变更原证照并选择同一资质换证链中的当前新版原件");
    if(q.expiresAt()!=null&&q.expiresAt().isBefore(LocalDate.now(ZoneId.of("Asia/Shanghai"))))throw new IllegalArgumentException("补件证照已过期");
    originals.loadObject(q);
    String result=mapper.reviewStatus(task.relationId(),q.id());
    if(!List.of("pending","approved").contains(result==null?"":result))throw new IllegalStateException("新版尚未生成复核或已被退回，请重新变更证照");
    if(mapper.reply(id,request.revision(),q.id(),request.response().strip(),actor())!=1)throw new IllegalStateException("补件状态已变化，请刷新后重试");
    if("approved".equals(result))mapper.settleSupplements(task.tenantId(),task.relationId(),q.id(),"closed");
    else for(String user:notices.buyerUsers(task.tenantId()))if(permissions.userHas(user,"buyer:supplier:manage"))notifications.notifyTenantUsers(task.tenantId(),List.of(user),"供应商已提交补件",task.supplierName()+"提交"+task.qualificationType()+"，请核验新版并发起变更审批。");
    audit.recordTenantAction(task.tenantId(),"qualification.supplement_replied","supplier_qualification",q.id(),"任务:"+id+";回复:"+request.response());return mapper.lockSupplement(id);
  }
  @Transactional public void cancelSupplement(String id,SupplementCancel request) {
    String tenant=buyer(true);if(mapper.cancelSupplement(tenant,id,request.revision())!=1)throw new IllegalStateException("任务不存在、已提交或状态已变化，请刷新");
    var task=mapper.lockSupplement(id);notifySupplier(task,"补件任务已取消",task.tenantName()+"取消补件，原因："+request.reason());
    audit.recordTenantAction(tenant,"qualification.supplement_cancelled","supplier_qualification",task.qualificationId(),request.reason());
  }
  private void notifySupplier(Supplement task,String title,String content){
    for(String user:notices.supplierUsers(task.supplierId()))if(permissions.userHas(user,"supplier:qualification:read"))notifications.notifyOnce(
        "qualification-supplement-"+UUID.nameUUIDFromBytes((task.id()+":"+task.revision()+":"+user+":"+title).getBytes(java.nio.charset.StandardCharsets.UTF_8)),task.tenantId(),user,title,content);
  }
}
