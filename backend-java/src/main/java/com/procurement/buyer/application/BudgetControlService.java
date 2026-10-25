package com.procurement.buyer.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.buyer.domain.BudgetPosition;
import com.procurement.buyer.infrastructure.BudgetLifecycleMapper;
import com.procurement.common.tenant.TenantAccessGuard;
import java.math.BigDecimal;
import java.time.ZoneId;
import java.time.OffsetDateTime;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Budget exposure is serialized before business row locks; all failures roll back the caller's transaction. */
@Service
public class BudgetControlService {
  private final BudgetLifecycleMapper mapper;
  private final AuditLogApplicationService audit;
  @org.springframework.beans.factory.annotation.Autowired
  private com.procurement.buyer.infrastructure.ProjectLifecycleMapper projectLifecycle;
  public BudgetControlService(BudgetLifecycleMapper mapper, AuditLogApplicationService audit) {
    this.mapper=mapper; this.audit=audit;
  }

  @Transactional
  public void lock(String tenantId) { mapper.lockTenant(tenantId); }

  public BudgetPosition position(String tenant,String department,String period) {
    var position=mapper.position(tenant,department,period);
    return position == null ? new BudgetPosition(department,department,period,BigDecimal.ZERO,
        mapper.version(tenant,department,period),BigDecimal.ZERO,BigDecimal.ZERO,BigDecimal.ZERO,BigDecimal.ZERO,BigDecimal.ZERO,false) : position;
  }

  @Transactional
  public void checkDemand(String tenant,String demandId,String department,OffsetDateTime createdAt) {
    String period=createdAt.atZoneSameInstant(ZoneId.of("Asia/Shanghai")).getYear()+"";
    if(projectLifecycle!=null){var effective=projectLifecycle.demandPeriod(tenant,demandId);if(effective!=null)period=effective;}
    check(tenant,department,period,"purchase_demand",demandId);
  }

  @Transactional
  public void recordOrder(String tenant,String orderId,String rfqId) {
    mapper.lockTenant(tenant);
    if (mapper.hasDemandLinks(tenant,rfqId)) {
      var pools=mapper.rfqPools(tenant,rfqId);
      if (pools.isEmpty() && !"warning".equals(mapper.mode(tenant))) {
        throw new IllegalStateException("订单关联需求的预算归属无法核实，请先核对需求状态和部门");
      }
      for(var pool:pools) check(tenant,(String)pool.get("department_id"),(String)pool.get("period"),"rfq",rfqId);
    } else {
      String actor=TenantAccessGuard.requireUserId("budget control");
      String department=mapper.actorDepartment(tenant,actor);
      if(department==null) {
        if(!"warning".equals(mapper.mode(tenant))) throw new IllegalStateException("经办人未关联有效部门，无法核验订单预算");
        audit.recordTenantAction(tenant,"budget.order_unassigned","purchase_order",orderId,"预警模式：经办人没有有效部门，订单预算归属待核对");
        return;
      }
      String period=OffsetDateTime.now(ZoneId.of("Asia/Shanghai")).getYear()+"";
      if(!mapper.assigned(tenant,orderId)) mapper.assign(tenant,orderId,department,period,actor);
      check(tenant,department,period,"department_order",department);
    }
  }

  private void check(String tenant,String department,String period,String type,String target) {
    String mode=mapper.mode(tenant);
    var policy=mapper.policy(tenant);
    if(!"warning".equals(mode) && (policy.invalidDemandCount()>0 || policy.unassignedOrderCount()>0)) {
      throw new IllegalStateException("存在未归属订单或预算资料不完整的需求，请先在预算工作区完成核对");
    }
    var position=position(tenant,department,period);
    if(position.occupied().compareTo(position.totalAmount())<=0) return;
    if("warning".equals(mode)) {
      audit.recordTenantAction(tenant,"budget.overrun_warning",type,target,"部门:"+department+";年度:"+period
          +";额度:"+position.totalAmount()+";占用:"+position.occupied());
      return;
    }
    if("approval".equals(mode)) {
      String actor=TenantAccessGuard.requireUserId("budget exception");
      var grant=mapper.exception(tenant,type,target,department,period,position.version(),position.occupied(),actor);
      if(grant!=null && mapper.consume(tenant,grant.id(),actor)==1) {
        audit.recordTenantAction(tenant,"budget.exception_used",type,target,"例外申请:"+grant.id()+";年度:"+period+";部门:"+department);
        return;
      }
      throw new IllegalStateException("本次业务超过可用预算，请先完成对应部门、年度和业务单据的超额例外审批");
    }
    throw new IllegalStateException("本次业务超过可用预算，当前为硬拦截模式，请先审批调整预算额度");
  }

  @Transactional
  public void checkProjectCarryover(String tenant,String department,String period,String request) {
    mapper.lockTenant(tenant);
    if(!"warning".equals(mapper.mode(tenant))&&position(tenant,department,period).occupied().compareTo(position(tenant,department,period).totalAmount())>0)
      throw new IllegalStateException("承接年度预算不足，请先审批调整该年度预算额度；不会挪用原年度额度或自动批准例外");
    check(tenant,department,period,"procurement_project",request);
  }

  @Transactional
  public void settleProject(String tenant,String rfq,String archive,BigDecimal orderAmount,BigDecimal paidAmount) {
    mapper.lockTenant(tenant);
    if(orderAmount==null || paidAmount==null || orderAmount.compareTo(paidAmount)!=0) {
      throw new IllegalStateException("项目未提供一致的订单和净付款金额，不能释放预算结余");
    }
    mapper.settle(tenant,rfq,archive,orderAmount,paidAmount,TenantAccessGuard.requireUserId("budget settlement"));
    audit.recordTenantAction(tenant,"budget.project_settled","rfq",rfq,"归档:"+archive+";最终占用:"+paidAmount);
  }
}
