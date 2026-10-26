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
    b.addAll(mapper.blockers(o.tenantId(), o.id()));
    if (!Set.of("待供应商确认", "待发货", "已发货", "已收货").contains(o.status())) b.add("订单状态不支持新建清算");
    if (mapper.locked(o.tenantId(), o.id())) b.add("已有未结束或已完成的清算");
    return b;
  }

  @Transactional(readOnly = true)
  public View view(String id, boolean supplier, int page, int size) {
    if (page < 1 || size < 1 || size > 100) throw new IllegalArgumentException("分页参数无效");
    var o = order(id, supplier, false);
    var a = policy.assess(mapper.baseline(o.tenantId(), id), null);
    return new View(
        new Preview(
            a.contractId(),
            a.kind(),
            a.goods(),
            a.paid(),
            a.invoiced(),
            supplier ? "{}" : a.snapshot(),
            supplier ? List.of() : blockers(o, a)),
        mapper.page(o.tenantId(), id, size, (long) (page - 1) * size).stream()
            .map(e -> supplier ? policy.supplierEntry(e) : e)
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
    return new Detail(
        supplier ? policy.supplierEntry(e) : e,
        items,
        n,
        n.subtract(e.finalAmount()).max(BigDecimal.ZERO),
        e.finalAmount().subtract(n).max(BigDecimal.ZERO),
        policy.completionBlockers(e, items));
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
    permissions.require("buyer:contract:manage");
    var old = mapper.byKey(o.tenantId(), id, r.requestKey());
    if (old != null) {
      var s = policy.tree(old.snapshot());
      if (!old.reason().equals(r.reason().strip())
          || !old.agreementId().equals(r.agreementId())
          || old.compensationAmount().compareTo(r.compensation()) != 0
          || !s.path("proposal").equals(policy.tree(policy.write(r))))
        throw new IllegalStateException("同一提交编号内容不同");
      return old;
    }
    var a = policy.assess(mapper.baseline(o.tenantId(), id), r.prices());
    allowed(blockers(o, a));
    BigDecimal total = a.goods().add(r.compensation());
    if (total.compareTo(o.amount()) > 0) throw new IllegalStateException("清算金额不得超过原订单金额；增额须另行变更审批");
    var p = proof(o, r.agreementId());
    var file = attachments.loadCurrentTenantObject(r.agreementId());
    if (p.contentSize() > 5 * 1024 * 1024) throw new IllegalArgumentException("清算协议限5MB");
    var snapshot = new LinkedHashMap<String, Object>();
    snapshot.put("assessment", policy.tree(a.snapshot()));
    snapshot.put("proposal", r);
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
    status(o, "清算协商中");
    event(o, "proposed", r.reason());
    return mapper.find(o.tenantId(), v.get("id").toString());
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
    var old = policy.tree(e.snapshot()).path("assessment").path("baseline");
    if (!old.equals(policy.tree(mapper.baseline(o.tenantId(), o.id()))))
      throw new IllegalStateException("履约或资金依据已变化，请驳回后重新申请");
    allowed(mapper.blockers(o.tenantId(), o.id()));
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
      permissions.require("buyer:contract:manage");
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
                      e.contractId(),
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
      var skus = mapper.returnSkus(o.tenantId(), order);
      for (String sku : skus)
        if (mapper.lockSku(sku) == null) throw new IllegalStateException("原始库存无法核验");
      if (mapper.restoreStock(o.tenantId(), order) != skus.size())
        throw new IllegalStateException("库存恢复数量不一致");
      state(o, e, "settled", null);
      contracts.archive(o.tenantId(), e.contractId(), id);
      status(o, "已清算");
    } else throw new IllegalArgumentException("无效操作");
    event(o, a, r.reason());
    var result = mapper.find(o.tenantId(), id);
    return supplier ? policy.supplierEntry(result) : result;
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
          || !previous.remark().equals(r.remark().strip()))
        throw new IllegalStateException("同一凭证请求内容不同");
      return previous;
    }
    if (!"approved".equals(e.status())) throw new IllegalStateException("审批通过后才能登记清算凭证");
    unchanged(o, e);
    var n = policy.net(e, mapper.evidence(o.tenantId(), id));
    BigDecimal limit =
        switch (r.kind()) {
          case "refund" -> n.subtract(e.finalAmount());
          case "payment" -> e.finalAmount().subtract(n);
          case "invoice" -> e.goodsAmount();
          case "compensation_receipt" -> e.compensationAmount();
          default -> throw new IllegalArgumentException("无效凭证类型");
        };
    if (r.amount().signum() < 0
        || (Set.of("refund", "payment").contains(r.kind())
            ? (r.amount().signum() <= 0 || r.amount().compareTo(limit) > 0)
            : r.amount().compareTo(limit) != 0)) throw new IllegalStateException("凭证金额与当前应清算金额不符");
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
    mapper.insertEvidence(v);
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
}
