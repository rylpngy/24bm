package com.procurement.buyer.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.buyer.api.BudgetContracts.*;
import com.procurement.buyer.domain.BudgetChange;
import com.procurement.buyer.domain.BudgetPosition;
import com.procurement.buyer.infrastructure.BudgetLifecycleMapper;
import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.application.DataScopeService;
import com.procurement.identity.application.PermissionService;
import com.procurement.identity.domain.DataScope;
import com.procurement.workflow.application.UnifiedWorkflowApplicationService;
import com.procurement.workflow.application.WorkflowStartCommand;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BudgetLifecycleService {
  private final BudgetLifecycleMapper mapper;
  private final PermissionService permissions;
  private final DataScopeService scopes;
  private final UnifiedWorkflowApplicationService workflow;
  private final AuditLogApplicationService audit;
  public BudgetLifecycleService(BudgetLifecycleMapper mapper,PermissionService permissions,DataScopeService scopes,
      UnifiedWorkflowApplicationService workflow,AuditLogApplicationService audit) {
    this.mapper=mapper;this.permissions=permissions;this.scopes=scopes;this.workflow=workflow;this.audit=audit;
  }
  private String tenant(String permission) {
    String tenant=TenantAccessGuard.requireTenantId("budget lifecycle");permissions.require(permission);return tenant;
  }
  private String actor() { return TenantAccessGuard.requireUserId("budget lifecycle"); }
  private void departmentScope(String department) {
    var scope=scopes.currentUserDataScope();
    if(scope.restricted() && (scope.requesterId()!=null || !scope.departmentIds().contains(department))) {
      throw new PermissionDeniedException("当前数据范围不允许维护该部门预算");
    }
  }
  private void requireAdministrator() {
    permissions.require("buyer:workflow:manage");
    if(scopes.currentUserDataScope().restricted()) throw new PermissionDeniedException("企业预算控制策略与无归属订单需要全企业数据权限");
  }
  public List<BudgetPosition> positions() {
    return mapper.positions(tenant("buyer:budget:read"),scopes.currentUserDataScope());
  }
  public BudgetPolicy policy() {
    String tenant=tenant("buyer:budget:read");
    return viewPolicy(mapper.policy(tenant));
  }
  private BudgetPolicy viewPolicy(BudgetPolicy policy) {
    boolean restricted=scopes.currentUserDataScope().restricted();
    boolean configure=!restricted && permissions.currentUserHas("buyer:budget:manage") && permissions.currentUserHas("buyer:workflow:manage");
    return new BudgetPolicy(policy.mode(),policy.revision(),policy.reason(),policy.updatedBy(),policy.updatedAt(),
        restricted?0:policy.unassignedOrderCount(),restricted?0:policy.invalidDemandCount(),configure);
  }
  public List<BudgetDepartment> departments() {
    return mapper.departments(tenant("buyer:budget:read"),scopes.currentUserDataScope());
  }
  @Transactional
  public BudgetPolicy updatePolicy(BudgetPolicyUpdate request) {
    String tenant=tenant("buyer:budget:manage");requireAdministrator();mapper.lockTenant(tenant);
    if(mapper.policyRevision(tenant)!=request.revision()) throw new IllegalStateException("预算策略已被修改，请刷新后重试");
    if(!"warning".equals(request.mode())) {
      if(!request.acknowledged()) throw new IllegalArgumentException("启用强控制前必须明确确认业务影响");
      var current=mapper.policy(tenant);
      if(current.unassignedOrderCount()>0 || current.invalidDemandCount()>0) {
        throw new IllegalStateException("请先处理未归属订单和预算资料不完整的需求，再启用强控制");
      }
    }
    mapper.savePolicy(tenant,request.mode(),request.reason().strip(),actor());
    audit.recordTenantAction(tenant,"budget.policy_changed","budget_policy",tenant,"模式:"+request.mode()+";原因:"+request.reason());
    return viewPolicy(mapper.policy(tenant));
  }
  @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
  public BudgetChangePage requests(String kind,int page,int size) {
    String tenant=tenant("buyer:budget:read");validatePage(page,size);
    if(!List.of("","initial","adjustment","exception").contains(kind)) throw new IllegalArgumentException("预算申请类型不支持");
    var scope=scopes.currentUserDataScope();
    return new BudgetChangePage(mapper.requests(tenant,scope,kind,size,(long)(page-1)*size),mapper.countRequests(tenant,scope,kind),page,size);
  }
  public BudgetChange request(String id) {
    String tenant=tenant("buyer:budget:read");var request=required(tenant,id);
    var scope=scopes.currentUserDataScope();
    if(scope.restricted() && (scope.requesterId()!=null ? !scope.requesterId().equals(request.createdBy())
        : !scope.departmentIds().contains(request.departmentId()))) throw new PermissionDeniedException("预算申请不在当前数据范围");
    return request;
  }
  private BudgetChange required(String tenant,String id) {
    var request=mapper.find(tenant,id);
    if(request==null) throw new IllegalArgumentException("预算申请不存在");return request;
  }
  private void requireOwner(BudgetChange request) {
    if(!actor().equals(request.createdBy())) throw new PermissionDeniedException("只能维护本人发起的预算申请");
    departmentScope(request.departmentId());
  }
  private void validateDraft(String tenant,BudgetDraft draft) {
    if(draft.targetAmount()==null || draft.targetAmount().signum()<0 || draft.targetAmount().scale()>2
        || draft.targetAmount().precision()-draft.targetAmount().scale()>14 || draft.title()==null || draft.title().isBlank()
        || draft.reason()==null || draft.reason().isBlank()) throw new IllegalArgumentException("请填写有效金额、申请名称和申请依据");
    departmentScope(draft.departmentId());
    if(!mapper.activeDepartment(tenant,draft.departmentId())) throw new IllegalArgumentException("请选择本企业有效部门");
    var total=mapper.total(tenant,draft.departmentId(),draft.period());
    if("initial".equals(draft.kind()) && total!=null) throw new IllegalArgumentException("该部门年度已有预算，请创建调整申请");
    if(!"initial".equals(draft.kind()) && total==null) throw new IllegalArgumentException("该部门年度尚无生效预算，请先编制预算");
    if("exception".equals(draft.kind())) {
      if(draft.targetAmount().compareTo(total)<=0) throw new IllegalArgumentException("例外总占用上限必须大于当前生效预算额度");
      boolean valid=switch(draft.targetType()==null ? "" : draft.targetType()) {
        case "purchase_demand" -> mapper.demandTarget(tenant,draft.targetId(),draft.departmentId(),draft.period());
        case "rfq" -> mapper.rfqTarget(tenant,draft.targetId(),draft.departmentId(),draft.period());
        case "department_order" -> draft.departmentId().equals(draft.targetId());
        default -> false;
      };
      if(!valid) throw new IllegalArgumentException("例外业务不在所选部门/年度范围，或业务类型不支持");
    } else if(draft.targetType()!=null || draft.targetId()!=null) throw new IllegalArgumentException("预算编制/调整不应关联例外业务");
  }
  @Transactional
  public BudgetChange create(BudgetDraft draft) {
    String tenant=tenant("buyer:budget:manage");mapper.lockTenant(tenant);validateDraft(tenant,draft);
    var base=mapper.total(tenant,draft.departmentId(),draft.period());
    var request=new BudgetChange("budget-request-"+UUID.randomUUID(),tenant,draft.departmentId(),draft.period(),draft.kind(),
        draft.targetAmount(),base==null?BigDecimal.ZERO:base,mapper.version(tenant,draft.departmentId(),draft.period()),0,
        draft.targetType(),draft.targetId(),draft.title().strip(),draft.reason().strip(),"draft",actor(),
        null,null,null,null,null,null,null,null,null);
    mapper.insert(request);
    audit.recordTenantAction(tenant,"budget.request_created","budget_request",request.id(),draft.kind()+":"+draft.targetAmount());
    return mapper.find(tenant,request.id());
  }
  @Transactional
  public BudgetChange edit(String id,BudgetDraft draft) {
    String tenant=tenant("buyer:budget:manage");mapper.lockTenant(tenant);var current=required(tenant,id);requireOwner(current);
    if(!current.departmentId().equals(draft.departmentId()) || !current.period().equals(draft.period()) || !current.kind().equals(draft.kind())
        || !java.util.Objects.equals(current.targetType(),draft.targetType()) || !java.util.Objects.equals(current.targetId(),draft.targetId())) {
      throw new IllegalArgumentException("草稿的部门、年度、类型及关联业务不能变更，请新建申请");
    }
    validateDraft(tenant,draft);var base=mapper.total(tenant,current.departmentId(),current.period());
    if(mapper.edit(tenant,id,draft.revision(),draft.targetAmount(),draft.title().strip(),draft.reason().strip(),
        base==null?BigDecimal.ZERO:base,mapper.version(tenant,current.departmentId(),current.period()))!=1) {
      throw new IllegalStateException("草稿已变更或已提交，请刷新后重试");
    }
    audit.recordTenantAction(tenant,"budget.request_updated","budget_request",id,draft.reason());return mapper.find(tenant,id);
  }
  @Transactional
  public BudgetChange submit(String id) {
    return submit(id,Map.of());
  }
  @Transactional
  public BudgetChange submit(String id,Map<String,Object> formData) {
    String tenant=tenant("buyer:budget:manage");mapper.lockTenant(tenant);var request=required(tenant,id);requireOwner(request);
    if(!"draft".equals(request.status())) throw new IllegalStateException("只能提交草稿；驳回或撤回后请新建申请，原记录保留");
    if(mapper.version(tenant,request.departmentId(),request.period())!=request.baseVersion()) {
      throw new IllegalStateException("生效预算已更新，请编辑草稿确认最新基线后提交");
    }
    if(!"exception".equals(request.kind()) && mapper.pendingChange(tenant,request.departmentId(),request.period())) {
      throw new IllegalStateException("该部门年度已有在审预算申请，请先处理完成");
    }
    if(mapper.status(tenant,id,"draft","submitted")!=1) throw new IllegalStateException("预算申请状态已变化");
    String type="exception".equals(request.kind())?"budget_exception":"budget_change";
    var snapshot=new java.util.LinkedHashMap<String,Object>();
    snapshot.put("title",request.title());snapshot.put("departmentId",request.departmentId());snapshot.put("period",request.period());
    snapshot.put("kind",request.kind());snapshot.put("baseAmount",request.baseAmount());snapshot.put("targetAmount",request.targetAmount());
    snapshot.put("reason",request.reason());snapshot.put("targetType",request.targetType());snapshot.put("targetId",request.targetId());
    var position=mapper.position(tenant,request.departmentId(),request.period());
    snapshot.put("occupiedAtSubmission",position==null?BigDecimal.ZERO:position.occupied());
    snapshot.put("remainingAtSubmission",position==null?BigDecimal.ZERO:position.remaining());
    snapshot.put("controlMode",mapper.mode(tenant));
    if("exception".equals(request.kind())) snapshot.put("exceptionValidityDays",7);
    var started=workflow.start(new WorkflowStartCommand(type,id,request.departmentId(),request.targetAmount(),formData==null?Map.of():formData,snapshot));
    mapper.bindWorkflow(tenant,id,started.workflowInstanceId());
    audit.recordTenantAction(tenant,"budget.request_submitted","budget_request",id,started.workflowInstanceId());return mapper.find(tenant,id);
  }
  @Transactional
  public BudgetChange withdraw(String id,String reason) {
    String tenant=tenant("buyer:budget:manage");var request=required(tenant,id);requireOwner(request);
    workflow.withdrawBudgetRequest(request.workflowInstanceId(),reason);return mapper.find(tenant,id);
  }
  @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
  public BudgetLedgerPage ledger(String department,String period,int page,int size) {
    String tenant=tenant("buyer:budget:read");validatePage(page,size);var scope=scopes.currentUserDataScope();
    return new BudgetLedgerPage(mapper.ledger(tenant,scope,department,period,size,(long)(page-1)*size),
        mapper.countLedger(tenant,scope,department,period),page,size);
  }
  @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
  public BudgetUnassignedPage unassigned(int page,int size) {
    String tenant=tenant("buyer:budget:manage");permissions.require("buyer:order:read");requireAdministrator();
    validatePage(page,size);
    return new BudgetUnassignedPage(mapper.unassigned(tenant,size,(long)(page-1)*size),mapper.policy(tenant).unassignedOrderCount(),page,size);
  }
  @Transactional
  public void assignOrder(String id,BudgetAssignment request) {
    String tenant=tenant("buyer:budget:manage");permissions.require("buyer:order:read");requireAdministrator();mapper.lockTenant(tenant);
    var order=mapper.order(tenant,id);
    if(order==null || !mapper.rfqPools(tenant,order.rfqId()).isEmpty() || mapper.assigned(tenant,id)) {
      throw new IllegalArgumentException("订单不存在、已关联需求或已有预算归属，不允许覆盖");
    }
    if(!mapper.activeDepartment(tenant,request.departmentId())) throw new IllegalArgumentException("请选择本企业有效部门");
    mapper.assign(tenant,id,request.departmentId(),request.period(),actor());
    audit.recordTenantAction(tenant,"budget.order_assigned","purchase_order",id,request.departmentId()+"/"+request.period()+":"+request.reason());
  }
  @Transactional(readOnly=true,isolation=Isolation.REPEATABLE_READ)
  public byte[] export(String department,String period) {
    String tenant=tenant("buyer:budget:read");var scope=scopes.currentUserDataScope();
    if(mapper.countLedger(tenant,scope,department,period)>5000) throw new IllegalArgumentException("导出超过5000行，请缩小部门或年度范围");
    var rows=mapper.ledger(tenant,scope,department,period,5000,0).stream().map(line->List.of(
        line.departmentId(),line.period(),line.sourceType(),line.sourceId(),line.label(),line.pending().toPlainString(),
        line.committed().toPlainString(),line.orderAmount().toPlainString(),line.paidAmount()==null?"待核对":line.paidAmount().toPlainString(),line.releasedAmount().toPlainString())).toList();
    return com.procurement.common.excel.ExcelSheets.template("预算占用",List.of("部门","年度","来源","单据编号","名称","预占","正式占用","关联订单","付款净额","已释放结余"),rows);
  }
  private void validatePage(int page,int size) {
    if(page<1 || size<1 || size>100) throw new IllegalArgumentException("页码必须大于0，每页条数为1至100");
  }
}
