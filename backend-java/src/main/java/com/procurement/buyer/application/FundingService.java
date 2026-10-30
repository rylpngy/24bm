package com.procurement.buyer.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.buyer.api.FundingContracts.*;
import com.procurement.buyer.domain.FundingAllocationPolicy;
import com.procurement.buyer.domain.FundingAllocationPolicy.Share;
import com.procurement.buyer.infrastructure.*;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.application.*;
import com.procurement.workflow.application.*;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

@Service
public class FundingService {
  @io.swagger.v3.oas.annotations.media.Schema(name = "SpecialFundingInvoice")
  public record InvoiceView(
      boolean enabled, String blocker, List<Balance> sources, List<Attribution> entries) {}

  private final FundingMapper mapper;
  private final ProcurementProjectGuard guard;
  private final ProcurementProjectMapper projects;
  private final ProjectLifecycleMapper lifecycle;
  private final PermissionService permissions;
  private final DataScopeService scopes;
  private final AuditLogApplicationService audit;
  private final ObjectMapper json;
  @Autowired @Lazy private UnifiedWorkflowApplicationService workflow;

  public FundingService(
      FundingMapper mapper,
      ProcurementProjectGuard guard,
      ProcurementProjectMapper projects,
      ProjectLifecycleMapper lifecycle,
      PermissionService permissions,
      DataScopeService scopes,
      AuditLogApplicationService audit,
      ObjectMapper json) {
    this.mapper = mapper;
    this.guard = guard;
    this.projects = projects;
    this.lifecycle = lifecycle;
    this.permissions = permissions;
    this.scopes = scopes;
    this.audit = audit;
    this.json = json;
  }

  private String tenant() {
    return TenantAccessGuard.requireTenantId("special funding");
  }

  private String actor() {
    return TenantAccessGuard.requireUserId("special funding");
  }

  private String write(Object o) {
    try {
      return json.writeValueAsString(o);
    } catch (Exception e) {
      throw new IllegalStateException("资金依据序列化失败", e);
    }
  }

  private com.fasterxml.jackson.databind.JsonNode tree(String s) {
    try {
      return json.readTree(s);
    } catch (Exception e) {
      throw new IllegalStateException("资金依据读取失败", e);
    }
  }

  private Request request(Change c) {
    try {
      return json.readValue(c.proposal(), Request.class);
    } catch (Exception e) {
      throw new IllegalStateException("资金申请读取失败", e);
    }
  }

  private void page(int page, int size) {
    if (page < 1 || size < 1 || size > 100) throw new IllegalArgumentException("分页参数不合法");
  }

  private Fund fund(String id) {
    var f = mapper.fund(tenant(), id);
    if (f == null) throw new IllegalArgumentException("资金来源不存在");
    scopes.requireRecordAccess(f.departmentId(), f.createdBy());
    return f;
  }

  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public FundPage funds(int page, int size) {
    permissions.require("buyer:budget:read");
    page(page, size);
    var scope = scopes.currentUserDataScope();
    return new FundPage(
        mapper.funds(tenant(), scope, size, (long) (page - 1) * size),
        mapper.fundCount(tenant(), scope),
        page,
        size);
  }

  @Transactional
  public Fund create(Draft r) {
    permissions.require("buyer:budget:manage");
    scopes.requireRecordAccess(r.departmentId(), actor());
    if (!mapper.department(tenant(), r.departmentId())) throw new IllegalArgumentException("部门无效");
    mapper.lock(tenant());
    String id = "fund-" + UUID.randomUUID();
    mapper.create(
        id, tenant(), r.departmentId(), r.period(), r.code().strip(), r.name().strip(), actor());
    audit.recordTenantAction(
        tenant(), "fund.created", "special_fund", id, r.code() + ":" + r.name());
    return mapper.fund(tenant(), id);
  }

  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public ChangePage history(String fund, String project, int page, int size) {
    permissions.require("buyer:budget:read");
    page(page, size);
    if (fund != null && !fund.isBlank()) fund(fund);
    if (project != null && !project.isBlank()) guard.require(project, false);
    String f = fund == null ? "" : fund, p = project == null ? "" : project;
    var scope = scopes.currentUserDataScope();
    return new ChangePage(
        mapper.changes(tenant(), scope, f, p, size, (long) (page - 1) * size),
        mapper.changeCount(tenant(), scope, f, p),
        page,
        size);
  }

  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public ProjectFunding project(String id) {
    permissions.require("buyer:budget:read");
    var p = guard.require(id, false);
    var s = scopes.currentUserDataScope();
    var choices =
        mapper.choices(tenant(), p.departmentId(), p.period()).stream()
            .filter(
                f ->
                    !s.restricted()
                        || (s.requesterId() != null
                            ? s.requesterId().equals(f.createdBy())
                            : s.departmentIds().contains(f.departmentId())))
            .toList();
    String blocker =
        mapper.paymentHistory(tenant(), id) > 0
            ? "项目已有付款历史，不支持重新分摊或撤销分摊"
            : mapper.pending(tenant(), null, id) > 0
                ? "资金分摊审批中"
                : mapper.conflicts(tenant(), id) > 0 ? "存在立项变更、跨年或清算责任，请先处理" : "";
    return new ProjectFunding(
        id,
        enabled(tenant(), id),
        mapper.plan(tenant(), id),
        choices,
        mapper.balances(tenant(), id),
        blocker);
  }

  private boolean enabled(String t, String p) {
    return !mapper.balances(t, p).isEmpty();
  }

  private List<Share> shares(Request r) {
    return r.lines() == null
        ? List.of()
        : r.lines().stream().map(x -> new Share(x.fundId(), x.amount())).toList();
  }

  private void lockRequest(Request r) {
    if ("project_plan".equals(r.kind())) {
      guard.lock();
      lifecycle.lockOrders(tenant(), r.projectId());
    }
    mapper.lock(tenant());
  }

  private Map<String, Object> inspect(Request r, boolean requireAccess) {
    if ("fund_limit".equals(r.kind())) {
      var f = mapper.fund(tenant(), r.fundId());
      if (f == null || r.projectId() != null) throw new IllegalArgumentException("资金来源无效");
      if (requireAccess) scopes.requireRecordAccess(f.departmentId(), f.createdBy());
      if (f.revision() != r.revision()) throw new IllegalStateException("资金额度版本已变化，请重新申请");
      if (r.amount().compareTo(f.reservedAmount()) < 0)
        throw new IllegalStateException("资金额度不能低于已占用责任");
      if (!shares(r).isEmpty()) throw new IllegalArgumentException("额度申请不能包含项目分摊");
      return new LinkedHashMap<>(
          Map.of(
              "fundId",
              f.id(),
              "departmentId",
              f.departmentId(),
              "period",
              f.period(),
              "revision",
              f.revision(),
              "oldLimit",
              f.totalAmount(),
              "code",
              f.code(),
              "name",
              f.name()));
    }
    if (!"project_plan".equals(r.kind()) || r.fundId() != null || r.projectId() == null)
      throw new IllegalArgumentException("资金业务类型无效");
    var p = projects.find(tenant(), r.projectId());
    if (p == null) throw new IllegalArgumentException("项目不存在");
    if (requireAccess) guard.require(p.id(), true);
    if (!"approved".equals(p.status()) || p.revision() != r.revision())
      throw new IllegalStateException("项目未批准或版本已变化");
    if (mapper.paymentHistory(tenant(), p.id()) > 0)
      throw new IllegalStateException("项目已有付款历史，不允许重分摊或追溯补造资金归属");
    if (mapper.conflicts(tenant(), p.id()) > 0)
      throw new IllegalStateException("请先处理立项变更、跨年度承接或订单清算责任");
    var lines = shares(r);
    if (lines.isEmpty()) {
      if (r.amount().signum() != 0 || mapper.plan(tenant(), p.id()) == null)
        throw new IllegalArgumentException("撤销分摊须为零金额且存在原方案");
    } else FundingAllocationPolicy.requireTotal(lines, p.plannedAmount());
    if (!lines.isEmpty() && r.amount().compareTo(p.plannedAmount()) != 0)
      throw new IllegalArgumentException("分摊总额须等于项目批准金额");
    var old = mapper.balances(tenant(), p.id());
    for (var line : lines) {
      var f = mapper.fund(tenant(), line.fundId());
      if (f == null
          || !"approved".equals(f.status())
          || !p.departmentId().equals(f.departmentId())
          || !p.period().equals(f.period()))
        throw new IllegalArgumentException("请选择同部门、同年度的已批准资金来源");
      if (requireAccess) scopes.requireRecordAccess(f.departmentId(), f.createdBy());
      BigDecimal existing =
          old.stream()
              .filter(b -> b.fundId().equals(f.id()))
              .map(Balance::allocatedAmount)
              .reduce(BigDecimal.ZERO, BigDecimal::add);
      if (line.amount().compareTo(f.availableAmount().add(existing)) > 0)
        throw new IllegalStateException(f.name() + "：专项资金额度不足，不挪用其他资金来源");
    }
    var snapshot = new LinkedHashMap<String, Object>();
    snapshot.put("projectId", p.id());
    snapshot.put("departmentId", p.departmentId());
    snapshot.put("period", p.period());
    snapshot.put("projectRevision", p.revision());
    snapshot.put("plannedAmount", p.plannedAmount());
    snapshot.put("previousPlan", Objects.toString(mapper.plan(tenant(), p.id()), ""));
    snapshot.put(
        "sources",
        lines.stream()
            .map(
                l -> {
                  var f = mapper.fund(tenant(), l.fundId());
                  return Map.of("fundId", f.id(), "code", f.code(), "name", f.name());
                })
            .toList());
    return snapshot;
  }

  @Transactional
  public Change submit(Request r) {
    permissions.require("buyer:budget:manage");
    if (r.requestKey() == null
        || r.requestKey().isBlank()
        || r.reason() == null
        || r.reason().isBlank()
        || r.amount() == null
        || r.amount().signum() < 0) throw new IllegalArgumentException("提交编号、金额和原因必填");
    lockRequest(r);
    var old = mapper.byKey(tenant(), r.requestKey());
    if (old != null) {
      if (!tree(old.proposal()).equals(tree(write(r))))
        throw new IllegalStateException("同一提交编号对应不同资金申请");
      scopes.requireRecordAccess(old.departmentId(), old.createdBy());
      return old;
    }
    var snapshot = inspect(r, true);
    if (mapper.pending(tenant(), r.fundId(), r.projectId()) > 0)
      throw new IllegalStateException("已有资金审批，请勿重复提交");
    String id = "funding-change-" + UUID.randomUUID(),
        dept = snapshot.get("departmentId").toString(),
        period = snapshot.get("period").toString();
    mapper.insert(
        new Change(
            id,
            tenant(),
            r.kind(),
            r.fundId(),
            r.projectId(),
            dept,
            period,
            r.revision(),
            r.amount(),
            r.requestKey(),
            write(r),
            write(snapshot),
            r.reason().strip(),
            "submitted",
            1,
            null,
            actor(),
            null,
            null,
            null));
    snapshot.put("reason", r.reason().strip());
    snapshot.put("proposal", r);
    var start =
        workflow.start(
            new WorkflowStartCommand(
                "funding_change",
                id,
                dept,
                r.amount(),
                r.formData() == null ? Map.of() : r.formData(),
                snapshot));
    if (mapper.bind(tenant(), id, start.workflowInstanceId()) != 1)
      throw new IllegalStateException("资金流程绑定失败");
    audit.recordTenantAction(tenant(), "funding.submitted", "funding_change", id, r.reason());
    return mapper.change(tenant(), id);
  }

  public Change validate(WorkflowBusinessInstance i, boolean approved) {
    if (!tenant().equals(i.tenantId())) throw new IllegalStateException("资金流程租户不匹配");
    var c = mapper.change(i.tenantId(), i.businessId());
    if (c == null
        || !"funding_change".equals(i.businessType())
        || !"submitted".equals(c.status())
        || !i.id().equals(c.workflowInstanceId())) throw new IllegalStateException("资金申请不在对应审批中");
    var r = request(c);
    lockRequest(r);
    if (approved && !tree(c.snapshot()).equals(tree(write(inspect(r, false)))))
      throw new IllegalStateException("资金或项目依据已变化，请驳回重提");
    return c;
  }

  public void complete(WorkflowBusinessInstance i, WorkflowCompletion c) {
    var change = validate(i, c.approved());
    var r = request(change);
    if (mapper.finish(
            i.tenantId(),
            change.id(),
            change.revision(),
            c.approved() ? "approved" : "rejected",
            c.actorId())
        != 1) throw new IllegalStateException("资金申请状态已变化");
    if (c.approved()) {
      if ("fund_limit".equals(change.kind())) {
        if (mapper.approveFund(
                i.tenantId(), change.fundId(), change.basedRevision(), change.amount())
            != 1) throw new IllegalStateException("资金版本已变化");
      } else {
        for (var l : shares(r))
          mapper.line(i.tenantId(), change.id(), change.projectId(), l.fundId(), l.amount());
        mapper.publish(i.tenantId(), change.projectId(), change.id());
      }
    }
    audit.recordTenantAction(
        i.tenantId(),
        "funding." + (c.approved() ? "approved" : "rejected"),
        "funding_change",
        change.id(),
        c.comment());
  }

  @Transactional
  public Change withdraw(String id, String reason) {
    permissions.require("buyer:budget:manage");
    var c = mapper.change(tenant(), id);
    if (c == null) throw new IllegalArgumentException("资金申请不存在");
    scopes.requireRecordAccess(c.departmentId(), c.createdBy());
    lockRequest(request(c));
    workflow.withdrawFundingChange(c.workflowInstanceId(), reason);
    return mapper.change(tenant(), id);
  }

  public void cancel(WorkflowBusinessInstance i, String actor) {
    var c = validate(i, false);
    if (mapper.finish(i.tenantId(), c.id(), c.revision(), "withdrawn", actor) != 1)
      throw new IllegalStateException("资金申请状态已变化");
  }

  private String invoiceProject(String t, String invoice) {
    var ids = mapper.invoiceProjects(t, invoice);
    if (ids.size() == 1 && !ids.getFirst().isBlank()) return ids.getFirst();
    if (ids.stream()
        .filter(x -> !x.isBlank())
        .anyMatch(p -> enabled(t, p) || mapper.pending(t, null, p) > 0))
      throw new IllegalStateException("存在混合项目资金归属，不能登记专项资金付款");
    return null;
  }

  public InvoiceView invoice(String t, String invoice) {
    String p;
    try {
      p = invoiceProject(t, invoice);
    } catch (IllegalStateException e) {
      return new InvoiceView(true, e.getMessage(), List.of(), List.of());
    }
    if (p == null) return new InvoiceView(false, "", List.of(), List.of());
    var balances = mapper.balances(t, p);
    boolean enabled = !balances.isEmpty();
    String blocker = "";
    if (mapper.pending(t, null, p) > 0) blocker = "项目资金分摊审批中，暂不能登记付款";
    if (enabled) {
      var project = projects.find(t, p);
      if (!"approved".equals(project.status())
          || balances.stream()
                  .map(Balance::allocatedAmount)
                  .reduce(BigDecimal.ZERO, BigDecimal::add)
                  .compareTo(project.plannedAmount())
              != 0) blocker = "项目状态或批准金额与资金分摊不一致，请核对";
    }
    return new InvoiceView(
        enabled || !blocker.isBlank(), blocker, balances, mapper.attributions(t, invoice));
  }

  @Transactional(propagation = Propagation.MANDATORY)
  public void pay(String t, String invoice, String entry, BigDecimal amount, List<Share> lines) {
    mapper.lock(t);
    var v = invoice(t, invoice);
    if (!v.blocker().isBlank()) throw new IllegalStateException(v.blocker());
    if (!v.enabled()) {
      if (lines != null && !lines.isEmpty()) throw new IllegalArgumentException("项目未启用已批准资金分摊");
      return;
    }
    var validated = FundingAllocationPolicy.requireTotal(lines, amount);
    String p = invoiceProject(t, invoice), plan = mapper.plan(t, p);
    for (var l : validated) {
      var b =
          v.sources().stream()
              .filter(x -> x.fundId().equals(l.fundId()))
              .findFirst()
              .orElseThrow(() -> new IllegalArgumentException("付款来源不属于项目已批分摊"));
      if (l.amount().compareTo(b.remainingAmount()) > 0)
        throw new IllegalStateException(b.name() + "：超过项目该资金来源的剩余额度");
      mapper.payment(t, entry, p, l.fundId(), plan, l.amount(), actor());
    }
    audit.recordTenantAction(
        t, "funding.payment_allocated", "invoice", invoice, entry + ":" + write(validated));
  }

  public boolean matches(String t, String entry, List<Share> lines) {
    var old = mapper.entry(t, entry);
    if ((lines == null || lines.isEmpty()) && old.isEmpty()) return true;
    try {
      var current =
          FundingAllocationPolicy.requireTotal(
              lines, old.stream().map(Share::amount).reduce(BigDecimal.ZERO, BigDecimal::add));
      if (current.size() != old.size()) return false;
      for (int n = 0; n < old.size(); n++)
        if (!old.get(n).fundId().equals(current.get(n).fundId())
            || old.get(n).amount().compareTo(current.get(n).amount()) != 0) return false;
      return true;
    } catch (IllegalArgumentException e) {
      return false;
    }
  }

  @Transactional(propagation = Propagation.MANDATORY)
  public void reverse(String t, String invoice, String original, String reversal) {
    mapper.lock(t);
    var old = mapper.entry(t, original);
    if (old.isEmpty()) {
      if (invoice(t, invoice).enabled()) throw new IllegalStateException("原付款资金归属缺失，不能推算冲销");
      return;
    }
    String p = invoiceProject(t, invoice), plan = mapper.plan(t, p);
    for (var l : old)
      mapper.payment(t, reversal, p, l.fundId(), plan, l.amount().negate(), actor());
    audit.recordTenantAction(
        t, "funding.payment_reversed", "invoice", invoice, original + ":" + reversal);
  }

  public void requireUnfundedProject(String t, String project) {
    if (enabled(t, project) || mapper.pending(t, null, project) > 0)
      throw new IllegalStateException("项目已启用或正在审批专项资金分摊，请先完成无付款项目的撤销分摊审批；已有付款不得直接跨年、变更或清算");
  }

  public void requireUnfundedInvoice(String t, String invoice) {
    if (invoice(t, invoice).enabled())
      throw new IllegalStateException("专项资金项目请使用金额台账明确填写资金来源，不支持兼容全额状态登记");
  }

  public void requireUnfundedOrder(String t, String order) {
    for (String p : mapper.orderProjects(t, order)) if (!p.isBlank()) requireUnfundedProject(t, p);
  }
}
