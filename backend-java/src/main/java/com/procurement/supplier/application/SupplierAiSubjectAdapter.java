package com.procurement.supplier.application;

import com.procurement.common.ai.*;
import com.procurement.common.ai.AiContracts.*;
import com.procurement.common.tenant.*;
import com.procurement.identity.application.PermissionService;
import com.procurement.identity.application.DataScopeService;
import com.procurement.order.application.OrderAccessService;
import com.procurement.supplier.domain.BuyerSupplierRelation;
import com.procurement.supplier.infrastructure.*;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import org.springframework.stereotype.Component;

@Component
public class SupplierAiSubjectAdapter implements AiSubjectAdapter {
  private final BuyerSupplierRelationMapper relations;
  private final SupplierQualificationMapper qualifications;
  private final SupplierFulfillmentMetricsService metrics;
  private final PermissionService permissions;
  private final DataScopeService scopes;
  private final SupplierFulfillmentMetricsMapper metricRows;
  private final OrderAccessService orders;
  public SupplierAiSubjectAdapter(BuyerSupplierRelationMapper relations, SupplierQualificationMapper qualifications,
      SupplierFulfillmentMetricsService metrics, PermissionService permissions,DataScopeService scopes,
      SupplierFulfillmentMetricsMapper metricRows,OrderAccessService orders) {
    this.relations=relations; this.qualifications=qualifications; this.metrics=metrics; this.permissions=permissions;
    this.scopes=scopes; this.metricRows=metricRows; this.orders=orders;
  }
  public String subjectType() { return "supplier"; }
  public void authorize(String id) { require(id); }
  public void authorizeSnapshot(String id,Snapshot snapshot) {
    require(id);
    for(var target:snapshot.accessTargets()) {
      if(!"receipt_order".equals(target.subjectType())) throw new IllegalArgumentException("Invalid supplier evidence target");
      orders.requireOrder(target.subjectId(),"buyer:supplier:read");
    }
  }
  private BuyerSupplierRelation require(String id) {
    permissions.require("buyer:supplier:read");
    var relation=relations.findByTenantAndId(TenantAccessGuard.requireTenantId("AI supplier relation"),id);
    if(relation==null) throw new PermissionDeniedException("Supplier relation not found in current tenant"); return relation;
  }
  @org.springframework.transaction.annotation.Transactional(readOnly=true,
      isolation=org.springframework.transaction.annotation.Isolation.REPEATABLE_READ,
      propagation=org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
  public Snapshot capture(String id) {
    var relation=require(id); var qualifications= this.qualifications.listActiveBySupplier(relation.supplierId());
    var metrics=this.metrics.metricsForSupplier(relation.supplierId());
    var ids=metricRows.aiReceiptOrderIds(TenantAccessGuard.requireTenantId("AI supplier metrics"),relation.supplierId(),scopes.currentUserDataScope());
    if(ids.size()>200) throw new IllegalArgumentException("Supplier review supports up to 200 contributing orders; review a narrower case");
    LocalDate today=LocalDate.now(ZoneId.of("Asia/Shanghai"));
    String revision=AiSupport.revision(Arrays.asList(id,relation.supplierId(),relation.status(),qualifications,metrics,today,ids));
    List<Evidence> evidence=new ArrayList<>(); List<Finding> findings=new ArrayList<>(); List<String> limitations=new ArrayList<>();
    evidence.add(AiSupport.field("relationStatus","已记录的供应商合作状态",relation.status(),id,revision));
    evidence.add(AiSupport.field("qualificationCount","有效状态的资质记录数",qualifications.size(),id,revision));
    evidence.add(AiSupport.field("receiptCount","当前权限内的验收样本数",metrics.receiptCount(),id,revision));
    evidence.add(AiSupport.field("qualifiedRate","当前可见样本数量合格率",metrics.qualifiedRate(),id,revision));
    evidence.add(AiSupport.field("scheduledReceiptCount","有预计日期的验收样本数",metrics.scheduledReceiptCount(),id,revision));
    evidence.add(AiSupport.field("asOfDate","有效期核验日期（北京时间）",today,id,revision));
    if(qualifications.isEmpty()) findings.add(AiSupport.finding("qualification-missing","warning","尚无有效状态的资质记录","未找到可供复核的有效状态资质，实际有效性须人工核验。","qualificationCount"));
    int index=0;
    for(var q:qualifications) {
      if(index++>=80) { limitations.add("仅检查前80条有效状态资质，其余记录未评估。"); break; }
      String eid="qualification:"+q.id()+":expiry";
      evidence.add(AiSupport.field(eid,"资质记录的到期日期",q.expiresAt(),q.id(),revision));
      if(q.expiresAt()==null) findings.add(AiSupport.finding("expiry-unknown-"+index,"warning","资质未记录到期日期","当前记录不足以判断资质是否在有效期内。",eid));
      else if(q.expiresAt().isBefore(today)) findings.add(AiSupport.finding("expired-"+index,"risk","资质记录已超过到期日期","记录的到期日期早于本次核验日期，请人工核对证书及续期材料。",eid,"asOfDate"));
    }
    if(metrics.receiptCount()==0) findings.add(AiSupport.finding("no-fulfillment-sample","warning","当前权限内暂无验收样本","没有已授权样本时，不作履约质量结论。","receiptCount"));
    if(metrics.scheduledReceiptCount()==0) findings.add(AiSupport.finding("no-delivery-date-sample","warning","暂无预计日期样本","当前样本不能支持收货准时率判断。","scheduledReceiptCount"));
    limitations.add("履约指标仅覆盖当前用户有权查看的验收样本；无样本不等于零绩效，不自动评分或决定准入。");
    limitations.add("资质元数据不代表证书真实性核验；未使用外部征信或搜索信息。");
    return new Snapshot(revision,evidence,findings,limitations,ids.stream().map(order -> new AccessTarget("receipt_order",order)).toList());
  }
}
