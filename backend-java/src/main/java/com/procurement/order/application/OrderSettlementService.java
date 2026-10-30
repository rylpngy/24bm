package com.procurement.order.application;

import com.procurement.attachment.application.AttachmentApplicationService;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.buyer.application.BudgetControlService;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.contract.application.ContractSettlementService;
import com.procurement.identity.application.PermissionService;
import com.procurement.order.api.OrderSettlementContracts.*;
import com.procurement.order.domain.PurchaseOrder;
import com.procurement.order.infrastructure.*;
import com.procurement.workflow.application.*;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrderSettlementService {
  @org.springframework.beans.factory.annotation.Autowired private com.procurement.buyer.application.FundingSettlementService funding;
  private final OrderSettlementMapper mapper;
  private final PurchaseOrderMapper orders;
  private final OrderAccessService access;
  private final BudgetControlService budget;
  private final PermissionService permissions;
  private final AuditLogApplicationService audit;
  private final AttachmentApplicationService attachments;
  private final ContractSettlementService contracts;
  private final OrderSettlementPolicy policy;
  private final UnifiedWorkflowApplicationService workflow;

  @org.springframework.beans.factory.annotation.Autowired
  private com.procurement.notification.application.NotificationApplicationService notifications;

  public OrderSettlementService(
      OrderSettlementMapper mapper,
      PurchaseOrderMapper orders,
      OrderAccessService access,
      BudgetControlService budget,
      PermissionService permissions,
      AuditLogApplicationService audit,
      AttachmentApplicationService attachments,
      ContractSettlementService contracts,
      OrderSettlementPolicy policy,
      @Lazy UnifiedWorkflowApplicationService workflow) {
    this.mapper = mapper;
    this.orders = orders;
    this.access = access;
    this.budget = budget;
    this.permissions = permissions;
    this.audit = audit;
    this.attachments = attachments;
    this.contracts = contracts;
    this.policy = policy;
    this.workflow = workflow;
  }

  private String actor() {
    return TenantAccessGuard.requireUserId("order settlement");
  }

  private PurchaseOrder order(String id, boolean supplier, boolean write) {
    PurchaseOrder o;
    if (supplier) {
      permissions.require(write ? "supplier:order:manage" : "supplier:order:read");
      o = orders.findBySupplierAndId(TenantAccessGuard.requireSupplierId("settlement"), id);
    } else {
      access.requireOrder(id, write ? "buyer:order:manage" : "buyer:order:read");
      o = orders.findByTenantAndId(TenantAccessGuard.requireTenantId("settlement"), id);
    }
    if (o == null) throw new IllegalArgumentException("订单不存在");
    if (write) {
      budget.lock(o.tenantId());
      o = orders.lockByTenantAndId(o.tenantId(), id);
    }
    return o;
  }

  private Entry entry(PurchaseOrder o, String id) {
    var e = mapper.find(o.tenantId(), id);
    if (e == null || !o.id().equals(e.orderId())) throw new IllegalArgumentException("清算申请不存在");
    return e;
  }

  private void allowed(List<String> b) {
    if (!b.isEmpty()) throw new IllegalStateException(String.join("；", b));
  }

  private List<String> blockers(PurchaseOrder o, OrderSettlementPolicy.Assessment a) {
    var b = new ArrayList<>(a.blockers());
    b.addAll(operationalBlockers(o,mapper.latest(o.tenantId(),o.id())!=null));
    if (!Set.of("待供应商确认", "待发货", "已发货", "已收货","已清算").contains(o.status())) b.add("订单状态不支持新建清算");
    if (mapper.locked(o.tenantId(), o.id())) b.add("已有未结束或已完成的清算");
    return b;
  }

  private List<String> operationalBlockers(PurchaseOrder o,boolean reopening){
    return mapper.blockers(o.tenantId(),o.id()).stream().filter(s->!reopening||!s.startsWith("已有采购或合同归档")).toList();
  }

  private OrderSettlementPolicy.Assessment assessment(PurchaseOrder o,List<Price> prices){
    var previous=mapper.latest(o.tenantId(),o.id());
    var raw=policy.tree(mapper.baseline(o.tenantId(),o.id()));
    if(previous==null)return policy.assess(policy.write(raw),prices);
    if(previous.kind().equals("draft_void"))throw new IllegalStateException("草案撤销不能直接重开");
    if(mapper.ambiguousCompensation(o.tenantId(),o.id()))throw new IllegalStateException("历史补偿款缺少逐项现金归属，须先核对，不能自动推算重开");
    var cash=mapper.cashPeriods(o.tenantId(),o.id());
    if(cash.stream().anyMatch(c->c.amount().signum()<0)||cash.stream().map(OrderSettlementMapper.CashPeriod::amount).reduce(BigDecimal.ZERO,BigDecimal::add).compareTo(previous.finalAmount())!=0)throw new IllegalStateException("上次清算与实际分项净付款不一致，不能自动推算重开");
    BigDecimal compensationPaid=cash.stream().filter(c->c.source().equals("~compensation")).map(OrderSettlementMapper.CashPeriod::amount).reduce(BigDecimal.ZERO,BigDecimal::add);
    if(compensationPaid.compareTo(previous.compensationAmount())!=0)throw new IllegalStateException("上次补偿款与实际净付款不一致，须先核对");
    var effective=(com.fasterxml.jackson.databind.node.ObjectNode)raw.deepCopy();
    for(var c:effective.path("contracts")){
      if(!c.path("id").asText().equals(previous.contractId())||!"已解除".equals(c.path("status").asText()))throw new IllegalStateException("原清算合同身份或状态不一致");
      ((com.fasterxml.jackson.databind.node.ObjectNode)c).put("status","已生效").put("archive_status","未归档");
    }
    var payments=effective.putArray("payments");
    effective.put("compensationPaid",compensationPaid);
    effective.put("unbilledPaid",mapper.cashPeriods(o.tenantId(),o.id()).stream().filter(c->c.source().equals("~unbilled")).map(OrderSettlementMapper.CashPeriod::amount).reduce(BigDecimal.ZERO,BigDecimal::add));
    for(var i:effective.path("invoices")){
      var net=mapper.cashPeriods(o.tenantId(),o.id()).stream().filter(c->c.source().equals(i.path("id").asText())).map(OrderSettlementMapper.CashPeriod::amount).reduce(BigDecimal.ZERO,BigDecimal::add);
      ((com.fasterxml.jackson.databind.node.ObjectNode)i).put("payment_status",net.signum()==0?"待付款":net.compareTo(i.path("amount").decimalValue())==0?"已付款":"部分付款");
      if(net.signum()!=0)payments.addObject().put("id","net:"+i.path("id").asText()).put("invoice_id",i.path("id").asText()).put("amount",net);
    }
    return policy.assess(policy.write(effective),prices);
  }

  @Transactional(readOnly = true)
  public View view(String id, boolean supplier, int page, int size) {
    if (page < 1 || size < 1 || size > 100) throw new IllegalArgumentException("分页参数无效");
    var o = order(id, supplier, false);
    OrderSettlementPolicy.Assessment a;
    String reopeningError=null;
    try{a=assessment(o,null);}catch(IllegalStateException ex){a=policy.assess(mapper.baseline(o.tenantId(),id),null);reopeningError=ex.getMessage();}
    var metadata=new LinkedHashMap<String,Object>(Map.of("lines",policy.tree(a.snapshot()).path("lines"),"invoiceBasis",allocation().basis(policy.tree(a.snapshot()).path("baseline")),"allocationRequired",allocation().required(policy.tree(a.snapshot()).path("baseline"))));
    var problems=new ArrayList<String>(supplier?List.of():blockers(o,a));
    if(!supplier&&reopeningError!=null)problems.add(reopeningError);
    var previous=mapper.latest(o.tenantId(),id);
    if(!supplier&&previous!=null){metadata.put("previousCompensationAmount",previous.compensationAmount());metadata.put("compensationPaid",policy.tree(a.snapshot()).path("baseline").path("compensationPaid").decimalValue());}
    if(!supplier){metadata.put("period",mapper.period(o.tenantId(),id));metadata.put("cashPeriods",mapper.cashPeriods(o.tenantId(),id));if(mapper.cashPeriods(o.tenantId(),id).stream().anyMatch(x->!x.period().equals(mapper.period(o.tenantId(),id))))metadata.put("allocationRequired",true);if(previous!=null){metadata.put("previousSettlementId",previous.id());metadata.put("allocationRequired",true);}}
    boolean canFunding=!supplier&&permissions.currentUserHas("buyer:budget:read");
    if(!supplier&&!mapper.locked(o.tenantId(),id))try{var basis=funding.prepare(o.tenantId(),id,a.paid(),null,false);if(basis!=null){if(canFunding){metadata.put("funding",basis);metadata.put("allocationRequired",true);}else problems.add("专项清算需要预算查看权限");}}catch(IllegalStateException ex){problems.add(ex.getMessage());}
    return new View(
        new Preview(
            a.contractId(),
            a.kind(),
            a.goods(),
            a.paid(),
            a.invoiced(),
            supplier
                ? "{}"
                : policy.write(metadata),
            problems),
        mapper.page(o.tenantId(), id, size, (long) (page - 1) * size).stream()
            .map(e->policy.sanitizedEntry(e,canFunding))
            .toList(),
        mapper.count(o.tenantId(), id),
        page,
        size,
        actor());
  }

  @Transactional(readOnly = true)
  public Detail detail(String order, String id, boolean supplier) {
    var o = order(order, supplier, false);
    var e = entry(o, id);
    var items = mapper.evidence(o.tenantId(), id);
    var n = policy.net(e, items);
    BigDecimal refundDue = n.subtract(e.finalAmount()).max(BigDecimal.ZERO);
    BigDecimal paymentDue = e.finalAmount().subtract(n).max(BigDecimal.ZERO);
    var plan = policy.tree(e.snapshot()).path("invoicePlan");
    if (plan.isArray()) {
      refundDue = BigDecimal.ZERO;
      paymentDue = BigDecimal.ZERO;
      for (var row : plan) {
        BigDecimal difference = allocation().balance(row, items).subtract(row.path("target").decimalValue());
        refundDue = refundDue.add(difference.max(BigDecimal.ZERO));
        paymentDue = paymentDue.add(difference.negate().max(BigDecimal.ZERO));
      }
    }
    return new Detail(
        policy.sanitizedEntry(e,!supplier&&permissions.currentUserHas("buyer:budget:read")),
        items,
        n,
        refundDue,
        paymentDue,
        policy.completionBlockers(e, items),
        supplier||!permissions.currentUserHas("buyer:budget:read")?List.of():funding.entries(o.tenantId(),id).stream().map(x->new FundingEntry(x.evidenceId(),x.fundId(),x.code(),x.name(),x.amount(),x.targetFundId(),x.targetName())).toList(),
        !supplier&&funding.read(e.snapshot())!=null);
  }

  private AttachmentApplicationService.ProcurementExecutionAttachmentMetadata proof(
      PurchaseOrder o, String id) {
    var p =
        attachments
            .procurementExecutionAttachmentMetadata("order_settlement_document", o.id())
            .stream()
            .filter(x -> x.id().equals(id))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("请选择本订单清算附件"));
    if (p.contentSha256() == null || p.contentSize() == null)
      throw new IllegalStateException("附件缺少真实原件或完整性核验未通过");
    byte[] bytes = attachments.loadCurrentTenantObject(id).data();
    try {
      if (bytes.length != p.contentSize()
          || !java.util.HexFormat.of()
              .formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(bytes))
              .equals(p.contentSha256())) throw new IllegalStateException("附件完整性核验失败");
    } catch (java.security.NoSuchAlgorithmException ex) {
      throw new IllegalStateException(ex);
    }
    return p;
  }

  @Transactional
  public Entry propose(String id, Proposal r) {
    var o = order(id, false, true);
    var old = mapper.byKey(o.tenantId(), id, r.requestKey());
    if (old != null) {
      var s = policy.tree(old.snapshot());
      if (!old.reason().equals(r.reason().strip())
          || !old.agreementId().equals(r.agreementId())
          || old.compensationAmount().compareTo(r.compensation()) != 0
          || !sameProposal(s.path("proposal"), r))
        throw new IllegalStateException("同一提交编号内容不同");
      return policy.sanitizedEntry(old,permissions.currentUserHas("buyer:budget:read"));
    }
    var previous=mapper.latest(o.tenantId(),id);
    if(!Objects.equals(r.previousSettlementId(),previous==null?null:previous.id()))throw new IllegalStateException("请明确关联当前已完成清算版本，刷新后重试");
    var a = assessment(o, r.prices());
    if (a.contractId() != null) permissions.require("buyer:contract:manage");
    allowed(blockers(o, a));
    var fundingBasis=funding.prepare(o.tenantId(),id,a.paid(),null,true);
    BigDecimal total = a.goods().add(r.compensation());
    if (total.compareTo(o.amount()) > 0) throw new IllegalStateException("清算金额不得超过原订单金额；增额须另行变更审批");
    var p = proof(o, r.agreementId());
    var file = attachments.loadCurrentTenantObject(r.agreementId());
    if (p.contentSize() > 5 * 1024 * 1024) throw new IllegalArgumentException("清算协议限5MB");
    var snapshot = new LinkedHashMap<String, Object>();
    snapshot.put("assessment", policy.tree(a.snapshot()));
    snapshot.put("proposal", r);
    snapshot.put("rawBaseline",policy.tree(mapper.baseline(o.tenantId(),id)));
    snapshot.put("period",mapper.period(o.tenantId(),id));
    snapshot.put("cashPeriods",mapper.cashPeriods(o.tenantId(),id));
    if(mapper.cashPeriods(o.tenantId(),id).stream().anyMatch(x->!x.period().equals(mapper.period(o.tenantId(),id)))&&r.allocations()==null)throw new IllegalArgumentException("跨年冻结订单清算须明确逐票最终归属");
    if(previous!=null){snapshot.put("previousSettlementId",previous.id());if(r.allocations()==null)throw new IllegalArgumentException("补充清算须明确逐票最终归属");}
    if(fundingBasis!=null)snapshot.put("funding",fundingBasis);
    if(fundingBasis!=null&&r.allocations()==null)throw new IllegalArgumentException("专项清算须明确填写逐票最终货款归属");
    if(r.compensation().signum()>0&&r.allocations()==null)throw new IllegalArgumentException("含补偿款清算须明确逐票货款归属，货款与补偿款分别核验");
    var plan = allocation().plan(policy.tree(a.snapshot()).path("baseline"), a.goods(), r.compensation(), r.allocations());
    if (plan != null) snapshot.put("invoicePlan", plan);
    var v = new HashMap<String, Object>();
    v.put("id", "settlement-" + UUID.randomUUID());
    v.put("t", o.tenantId());
    v.put("o", id);
    v.put("supplier", o.supplierId());
    v.put("contract", a.contractId());
    v.put("key", r.requestKey());
    v.put("kind", a.kind());
    v.put("reason", r.reason().strip());
    v.put("previous", o.status());
    v.put("snapshot", policy.write(snapshot));
    v.put("goods", a.goods());
    v.put("compensation", r.compensation());
    v.put("total", total);
    v.put("paid", a.paid());
    v.put("invoiced", a.invoiced());
    v.put("actor", actor());
    v.put("attachment", p.id());
    v.put("filename", p.fileName());
    v.put("sha", p.contentSha256());
    v.put("bytes", file.data());
    mapper.insert(v);
    if(previous!=null)budget.recordOrder(o.tenantId(),o.id(),o.rfqId());
    status(o, "清算协商中");
    event(o, "proposed", r.reason());
    return policy.sanitizedEntry(mapper.find(o.tenantId(), v.get("id").toString()),true);
  }

  private void status(PurchaseOrder o, String next) {
    if (orders.updateStatus(o.tenantId(), o.id(), o.status(), next) != 1)
      throw new IllegalStateException("订单状态已变化");
  }

  private void state(PurchaseOrder o, Entry e, String next, String flow) {
    if (mapper.state(o.tenantId(), e.id(), e.revision(), e.status(), next, flow, actor()) != 1)
      throw new IllegalStateException("清算版本已变化，请刷新");
  }

  private void unchanged(PurchaseOrder o, Entry e) {
    var snapshot=policy.tree(e.snapshot());
    var old = snapshot.has("rawBaseline")?snapshot.path("rawBaseline"):snapshot.path("assessment").path("baseline");
    if (!old.equals(policy.tree(mapper.baseline(o.tenantId(), o.id()))))
      throw new IllegalStateException("履约或资金依据已变化，请驳回后重新申请");
    var previous=mapper.latest(o.tenantId(),o.id());
    if(snapshot.has("previousSettlementId")&&(previous==null||!previous.id().equals(snapshot.path("previousSettlementId").asText())))throw new IllegalStateException("上次清算版本已变化");
    allowed(operationalBlockers(o,snapshot.has("previousSettlementId")));
    funding.validate(o.tenantId(),o.id(),e.id(),e.snapshot(),e.initialPaid());
  }

  @Transactional
  public Entry act(String order, String id, Action r, boolean supplier) {
    var o = order(order, supplier, true);
    var e = entry(o, id);
    if (e.revision() != r.revision()) throw new IllegalStateException("清算版本已变化，请刷新");
    String a = r.action();
    if (supplier) {
      if (!Set.of("accept", "reject").contains(a)
          || !"supplier_pending".equals(e.status())
          || actor().equals(e.createdBy())) throw new IllegalStateException("当前账号不能办理本次供应商确认");
      unchanged(o, e);
      String next = "accept".equals(a) ? "agreed" : "rejected";
      if (mapper.consent(o.tenantId(), id, r.revision(), next, actor(), r.reason().strip()) != 1)
        throw new IllegalStateException("清算版本已变化");
      if ("rejected".equals(next)) status(o, e.previousStatus());
    } else if ("withdraw".equals(a)) {
      if (!actor().equals(e.createdBy())
          || !Set.of("supplier_pending", "agreed").contains(e.status()))
        throw new IllegalStateException("仅原发起人可在内部审批前撤回");
      state(o, e, "withdrawn", null);
      status(o, e.previousStatus());
    } else if ("submit".equals(a)) {
      if (e.contractId() != null) permissions.require("buyer:contract:manage");
      if (!actor().equals(e.createdBy()) || !"agreed".equals(e.status()))
        throw new IllegalStateException("须供应商先确认，由原发起人提审");
      unchanged(o, e);
      state(o, e, "submitted", null);
      String dept =
          policy.tree(mapper.baseline(o.tenantId(), order)).path("departmentId").asText(null);
      var start =
          workflow.start(
              new WorkflowStartCommand(
                  "order_settlement",
                  id,
                  dept,
                  e.finalAmount(),
                  r.formData() == null ? Map.of() : r.formData(),
                  Map.of(
                      "orderId",
                      order,
                      "contractId",
                      e.contractId() == null ? "" : e.contractId(),
                      "reason",
                      e.reason(),
                      "finalAmount",
                      e.finalAmount(),
                      "goodsAmount",
                      e.goodsAmount(),
                      "initialPaid",
                      e.initialPaid(),
                      "settlementSnapshot",
                      policy.tree(e.snapshot()))));
      var bound = mapper.find(o.tenantId(), id);
      state(o, bound, "submitted", start.workflowInstanceId());
    } else if ("complete".equals(a)) {
      permissions.require("buyer:payment:register");
      if (!"approved".equals(e.status())) throw new IllegalStateException("内部审批通过后才能清算");
      unchanged(o, e);
      var items = mapper.evidence(o.tenantId(), id);
      allowed(policy.completionBlockers(e, items));
      proof(o, e.agreementId());
      for (var x : items) {
        if (!x.contentSha().equals(proof(o, x.attachmentId()).contentSha256()))
          throw new IllegalStateException("清算凭证原件已变化");
      }
      var skus = policy.tree(e.snapshot()).has("previousSettlementId")?List.<String>of():mapper.returnSkus(o.tenantId(), order);
      for (String sku : skus)
        if (mapper.lockSku(sku) == null) throw new IllegalStateException("原始库存无法核验");
      if (!policy.tree(e.snapshot()).has("previousSettlementId")&&mapper.restoreStock(o.tenantId(), order) != skus.size())
        throw new IllegalStateException("库存恢复数量不一致");
      state(o, e, "settled", null);
      if (e.contractId() != null) contracts.archive(o.tenantId(), e.contractId(), id);
      status(o, "已清算");
    } else throw new IllegalArgumentException("无效操作");
    event(o, a, r.reason());
    var result = mapper.find(o.tenantId(), id);
    return policy.sanitizedEntry(result,!supplier&&permissions.currentUserHas("buyer:budget:read"));
  }

  @Transactional
  public Evidence evidence(String order, String id, EvidenceRequest r) {
    var o = order(order, false, true);
    permissions.require("buyer:payment:register");
    var e = entry(o, id);
    var previous = mapper.evidenceByKey(o.tenantId(), id, r.requestKey());
    if (previous != null) {
      if (!previous.kind().equals(r.kind())
          || previous.amount().compareTo(r.amount()) != 0
          || !previous.evidenceNo().equals(r.evidenceNo().strip())
          || !previous.attachmentId().equals(r.attachmentId())
          || !previous.remark().equals(r.remark().strip())
          || !Objects.equals(previous.source(), r.source())
          || (r.cashPeriod()!=null&&!Objects.equals(previous.cashPeriod(),r.cashPeriod()))
          || !funding.matches(o.tenantId(),previous.id(),fundingLines(r)))
        throw new IllegalStateException("同一凭证请求内容不同");
      return previous;
    }
    if (!"approved".equals(e.status())) throw new IllegalStateException("审批通过后才能登记清算凭证");
    unchanged(o, e);
    var items = mapper.evidence(o.tenantId(), id);
    var n = policy.net(e, items);
    var plan = policy.tree(e.snapshot()).path("invoicePlan");
    if (plan.isArray()) allocation().validate(plan, items, r);
    else if (r.source() != null) throw new IllegalArgumentException("本清算方案未设置逐票归属");
    BigDecimal limit =
        switch (r.kind()) {
          case "refund" -> n.subtract(e.finalAmount());
          case "payment" -> e.finalAmount().subtract(n);
          case "invoice" -> e.goodsAmount();
          case "compensation_receipt" -> e.compensationAmount();
          default -> throw new IllegalArgumentException("无效凭证类型");
        };
    if (!plan.isArray() && (r.amount().signum() < 0
        || (Set.of("refund", "payment").contains(r.kind())
            ? (r.amount().signum() <= 0 || r.amount().compareTo(limit) > 0)
            : r.amount().compareTo(limit) != 0))) throw new IllegalStateException("凭证金额与当前应清算金额不符");
    var p = proof(o, r.attachmentId());
    var v = new HashMap<String, Object>();
    v.put("id", "settlement-proof-" + UUID.randomUUID());
    v.put("t", o.tenantId());
    v.put("settlement", id);
    v.put("key", r.requestKey());
    v.put("kind", r.kind());
    v.put("amount", r.amount());
    v.put("reference", r.evidenceNo().strip());
    v.put("attachment", p.id());
    v.put("sha", p.contentSha256());
    v.put("remark", r.remark().strip());
    v.put("actor", actor());
    v.put("source", r.source());
    v.put("period",cashPeriod(e,r,items));
    if(funding.read(e.snapshot())!=null&&Set.of("refund","payment").contains(r.kind()))for(var l:r.fundingLines()==null?List.<FundingLine>of():r.fundingLines()){
      var fund=funding.read(e.snapshot()).sources().stream().filter(x->x.fundId().equals(l.fundId())).findFirst().orElseThrow();
      if(!fund.period().equals(v.get("period")))throw new IllegalArgumentException("现金归属年度与所选资金来源不一致");
    }
    mapper.insertEvidence(v);
    funding.record(o.tenantId(),order,id,v.get("id").toString(),e.snapshot(),r.kind(),r.source(),r.amount(),fundingLines(r),actor());
    event(o, "evidence", r.kind() + ":" + r.amount() + ":" + r.evidenceNo());
    return mapper.evidenceByKey(o.tenantId(), id, r.requestKey());
  }

  @Transactional
  public void validate(WorkflowBusinessInstance i, boolean approved) {
    budget.lock(i.tenantId());
    var e = mapper.find(i.tenantId(), i.businessId());
    if (e == null || !"submitted".equals(e.status()) || !i.id().equals(e.workflowInstanceId()))
      throw new IllegalStateException("清算不在对应审批中");
    var o = orders.lockByTenantAndId(i.tenantId(), e.orderId());
    if (approved) unchanged(o, e);
  }

  @Transactional
  public void complete(WorkflowBusinessInstance i, WorkflowCompletion c) {
    validate(i, c.approved());
    var e = mapper.find(i.tenantId(), i.businessId());
    var o = orders.lockByTenantAndId(i.tenantId(), e.orderId());
    state(o, e, c.approved() ? "approved" : "rejected", null);
    status(o, c.approved() ? "待清算" : e.previousStatus());
    event(o, c.approved() ? "approved" : "rejected", c.comment());
  }

  @Transactional(readOnly = true)
  public byte[] agreement(String order, String id, boolean supplier) {
    var o = order(order, supplier, false);
    entry(o, id);
    return mapper.agreement(o.tenantId(), id).bytes();
  }

  private void event(PurchaseOrder o, String action, String reason) {
    audit.recordTenantAction(
        o.tenantId(), "order.settlement." + action, "purchase_order", o.id(), reason);
    notifications.notifyActiveTenantUsers(o.tenantId(), "合同清算进度", "订单 " + o.id() + "：" + action);
    notifications.notifyActiveSupplierUsers(
        o.tenantId(), o.supplierId(), "合同清算进度", "订单 " + o.id() + "：" + action);
  }

  private OrderSettlementAllocationPolicy allocation() {
    return new OrderSettlementAllocationPolicy(new com.fasterxml.jackson.databind.ObjectMapper());
  }

  private List<com.procurement.buyer.application.FundingSettlementService.Allocation> fundingLines(EvidenceRequest r){
    if(r.fundingLines()==null)return null;
    return r.fundingLines().stream().map(x->{if(x==null)throw new IllegalArgumentException("资金来源不得为空");return new com.procurement.buyer.application.FundingSettlementService.Allocation(x.fundId(),x.amount(),x.targetFundId());}).toList();
  }

  private boolean sameProposal(com.fasterxml.jackson.databind.JsonNode saved, Proposal request) {
    var normalized = saved.deepCopy();
    if (normalized.isObject() && !normalized.has("allocations")) ((com.fasterxml.jackson.databind.node.ObjectNode) normalized).putNull("allocations");
    if(normalized.isObject()&&!normalized.has("previousSettlementId"))((com.fasterxml.jackson.databind.node.ObjectNode)normalized).putNull("previousSettlementId");
    return normalized.equals(policy.tree(policy.write(request)));
  }

  private String cashPeriod(Entry e,EvidenceRequest r,List<Evidence> items){
    var s=policy.tree(e.snapshot());String current=s.path("period").asText(null);
    if(!Set.of("refund","payment").contains(r.kind())){if(r.cashPeriod()!=null)throw new IllegalArgumentException("非现金凭证不填资金年度");return null;}
    if(current==null)return null;
    if("payment".equals(r.kind())){if(r.cashPeriod()!=null&&!current.equals(r.cashPeriod()))throw new IllegalArgumentException("补付款只允许当前责任年度");return current;}
    var rows=s.path("cashPeriods");var periods=new TreeSet<String>();
    for(var row:rows)if(r.source()==null||r.source().equals(row.path("source").asText()))periods.add(row.path("period").asText());
    String selected=r.cashPeriod();if(selected==null&&periods.size()==1&&periods.contains(current))selected=current;
    if(selected==null||!periods.contains(selected))throw new IllegalArgumentException("请选择该发票原实际付款年度，历史冻结退款不得默认记入当年");
    BigDecimal available=BigDecimal.ZERO;
    for(var row:rows)if(selected.equals(row.path("period").asText())&&(r.source()==null||r.source().equals(row.path("source").asText())))available=available.add(row.path("amount").decimalValue());
    for(var x:items)if(selected.equals(x.cashPeriod())&&Objects.equals(x.source(),r.source()))available=available.add("refund".equals(x.kind())?x.amount().negate():"payment".equals(x.kind())?x.amount():BigDecimal.ZERO);
    if(r.amount().compareTo(available)>0)throw new IllegalArgumentException("退款超过该发票该年度已付净额");
    return selected;
  }
}
