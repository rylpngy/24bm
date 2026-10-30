package com.procurement.finance.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.buyer.application.BudgetControlService;
import com.procurement.buyer.application.ProcurementProjectGuard;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.contract.application.ContractInstallmentService;
import com.procurement.finance.api.FrozenPaymentCorrectionContracts.*;
import com.procurement.finance.domain.PaymentEntry;
import com.procurement.finance.infrastructure.*;
import com.procurement.workflow.application.*;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import java.util.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

@Service
public class FrozenPaymentCorrectionService {
  private final FrozenPaymentCorrectionMapper mapper;
  private final InvoiceMapper invoices;
  private final PaymentEntryMapper entries;
  private final FinanceAccessService access;
  private final PaymentApplicationService payments;
  private final ContractInstallmentService installments;
  private final ProcurementProjectGuard projects;
  private final BudgetControlService budget;
  private final AuditLogApplicationService audit;
  private final ObjectMapper json;
  private final PaymentExecutionRecordMapper executions;
  @Autowired @Lazy private UnifiedWorkflowApplicationService workflow;

  public FrozenPaymentCorrectionService(
      FrozenPaymentCorrectionMapper mapper,
      InvoiceMapper invoices,
      PaymentEntryMapper entries,
      FinanceAccessService access,
      PaymentApplicationService payments,
      ContractInstallmentService installments,
      ProcurementProjectGuard projects,
      BudgetControlService budget,
      AuditLogApplicationService audit,
      ObjectMapper json,
      PaymentExecutionRecordMapper executions) {
    this.mapper = mapper;
    this.invoices = invoices;
    this.entries = entries;
    this.access = access;
    this.payments = payments;
    this.installments = installments;
    this.projects = projects;
    this.budget = budget;
    this.audit = audit;
    this.json = json;
    this.executions = executions;
  }

  private String tenant() {
    return TenantAccessGuard.requireTenantId("frozen payment correction");
  }

  private String actor() {
    return TenantAccessGuard.requireUserId("frozen payment correction");
  }

  private String write(Object value) {
    try {
      return json.writeValueAsString(value);
    } catch (Exception e) {
      throw new IllegalStateException("更正依据序列化失败", e);
    }
  }

  private com.fasterxml.jackson.databind.JsonNode tree(String value) {
    try {
      return json.readTree(value);
    } catch (Exception e) {
      throw new IllegalStateException("更正依据读取失败", e);
    }
  }

  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public List<Candidate> candidates(String invoice) {
    access.requireInvoice(invoice, "buyer:invoice:read");
    List<Candidate> result = new ArrayList<>();
    for (var e : entries.list(tenant(), invoice)) {
      if (e.amount().signum() <= 0 || !invoices.carriedPayment(tenant(), invoice, e.id())) continue;
      var basis = mapper.basis(tenant(), invoice, e.id());
      var problems = new ArrayList<String>();
      try {
        inspect(tenant(), invoice, e.id());
      } catch (IllegalStateException ex) {
        problems.add(ex.getMessage());
      }
      if (mapper.active(tenant(), e.id())) problems.add("该流水已有在审或已批准更正，请查看台账");
      result.add(
          new Candidate(
              e.id(),
              e.amount(),
              e.evidenceNo(),
              basis.size() == 1 ? basis.getFirst().projectId() : null,
              basis.size() == 1 ? basis.getFirst().sourcePeriod() : null,
              basis.size() == 1 ? basis.getFirst().targetPeriod() : null,
              List.copyOf(problems)));
    }
    return result;
  }

  @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
  public Page history(String invoice, int page, int size) {
    access.requireInvoice(invoice, "buyer:invoice:read");
    if (page < 1 || size < 1 || size > 100) throw new IllegalArgumentException("分页参数不合法");
    return new Page(
        mapper.page(tenant(), invoice, size, (long) (page - 1) * size),
        mapper.count(tenant(), invoice),
        page,
        size);
  }

  private void lock(String t, String invoice) {
    projects.lock();
    if (invoices.lockOrderForInvoice(t, invoice) == null)
      throw new IllegalStateException("发票订单不存在");
    invoices.lockByTenantAndId(t, invoice);
    payments.requireFinanceEnabled(t);
  }

  private Map<String, Object> inspect(String t, String invoiceId, String entry) {
    var invoice = invoices.findByTenantAndId(t, invoiceId);
    if (invoice == null) throw new IllegalStateException("发票不存在");
    if (invoices.projectLiquidated(t, invoiceId))
      throw new IllegalStateException("项目已清算，不能更正原付款依据");
    var list = entries.list(t, invoiceId);
    var original =
        list.stream()
            .filter(e -> e.id().equals(entry))
            .findFirst()
            .orElseThrow(() -> new IllegalStateException("原付款不存在"));
    if (original.amount().signum() <= 0
        || original.reversalOf() != null
        || list.stream().anyMatch(e -> entry.equals(e.reversalOf())))
      throw new IllegalStateException("原付款已冲销或不是正向付款，不能再次更正");
    PaymentAuthorizationService.requireKnownBalance(invoice, entries.balance(t, invoiceId));
    var bases = mapper.basis(t, invoiceId, entry);
    if (bases.size() != 1) throw new IllegalStateException("付款未被跨年冻结或项目来源不唯一，须先核对归属");
    var b = bases.getFirst();
    if (!"approved".equals(b.projectStatus()) || b.conflicts() > 0)
      throw new IllegalStateException("项目须已批准且不存在在审变更、承接或订单清算");
    var frozen = mapper.frozenAmount(t, b.departmentId(), b.rfqId(), b.sourcePeriod());
    if (frozen == null
        || frozen.compareTo(original.amount()) < 0
        || b.targetPeriod().compareTo(b.sourcePeriod()) <= 0)
      throw new IllegalStateException("冻结年度金额无法核对，不能推算或修改历史支出");
    var milestones = installments.balances(t, invoice.orderId());
    if (milestones.stream().anyMatch(m -> !m.verified()))
      throw new IllegalStateException("合同付款计划待核对");
    var snapshot = new LinkedHashMap<String, Object>();
    snapshot.put("invoiceId", invoiceId);
    snapshot.put("projectId", b.projectId());
    snapshot.put("basis", b);
    snapshot.put("invoice", invoice);
    snapshot.put("original", original);
    snapshot.put("entries", list);
    snapshot.put("frozenAmount", frozen);
    snapshot.put("milestones", milestones);
    return snapshot;
  }

  @Transactional
  public Correction submit(String invoice, Request r) {
    access.requireInvoice(invoice, "buyer:payment:reverse");
    lock(tenant(), invoice);
    if (r.requestKey() == null
        || r.requestKey().isBlank()
        || r.entryId() == null
        || r.evidenceNo() == null
        || r.evidenceNo().isBlank()
        || r.reason() == null
        || r.reason().isBlank()) throw new IllegalArgumentException("原流水、提交编号、更正凭据号和原因必填");
    var old = mapper.byKey(tenant(), invoice, r.requestKey().strip());
    if (old != null) {
      if (!old.entryId().equals(r.entryId())
          || !old.reason().equals(r.reason().strip())
          || !old.evidenceNo().equals(r.evidenceNo().strip())
          || !tree(old.snapshot())
              .path("submittedFormData")
              .equals(json.valueToTree(r.formData() == null ? Map.of() : r.formData())))
        throw new IllegalStateException("同一提交编号对应不同更正内容");
      return old;
    }
    var snapshot = inspect(tenant(), invoice, r.entryId());
    if (mapper.active(tenant(), r.entryId())) throw new IllegalStateException("该流水已有在审或已批准更正");
    var b = (FrozenPaymentCorrectionMapper.Basis) snapshot.get("basis");
    var original = (PaymentEntry) snapshot.get("original");
    String id = "frozen-correction-" + UUID.randomUUID();
    snapshot.put("submittedFormData", r.formData() == null ? Map.of() : r.formData());
    mapper.insert(
        new Correction(
            id,
            tenant(),
            invoice,
            r.entryId(),
            r.requestKey().strip(),
            b.projectId(),
            b.departmentId(),
            b.rfqId(),
            b.sourcePeriod(),
            b.targetPeriod(),
            original.amount(),
            r.evidenceNo().strip(),
            r.reason().strip(),
            write(snapshot),
            "submitted",
            1,
            null,
            null,
            actor(),
            null,
            null,
            null));
    snapshot.put("reason", r.reason().strip());
    snapshot.put("evidenceNo", r.evidenceNo().strip());
    var started =
        workflow.start(
            new WorkflowStartCommand(
                "frozen_payment_correction",
                id,
                b.departmentId(),
                original.amount(),
                r.formData() == null ? Map.of() : r.formData(),
                snapshot));
    if (mapper.bind(tenant(), id, started.workflowInstanceId()) != 1)
      throw new IllegalStateException("更正流程绑定失败");
    audit.recordTenantAction(
        tenant(), "invoice.frozen_correction_submitted", "invoice", invoice, id + ":" + r.reason());
    return mapper.find(tenant(), id);
  }

  public Correction validate(WorkflowBusinessInstance i, boolean approved) {
    var r = mapper.find(i.tenantId(), i.businessId());
    if (r == null
        || !"frozen_payment_correction".equals(i.businessType())
        || !"submitted".equals(r.status())
        || !i.id().equals(r.workflowInstanceId())) throw new IllegalStateException("更正申请不在对应审批中");
    lock(i.tenantId(), r.invoiceId());
    var baseline = (com.fasterxml.jackson.databind.node.ObjectNode) tree(r.snapshot());
    baseline.remove("submittedFormData");
    if (approved
        && !baseline.equals(tree(write(inspect(i.tenantId(), r.invoiceId(), r.entryId())))))
      throw new IllegalStateException("付款、项目年度或里程碑依据已变化，请驳回后重新申请");
    return r;
  }

  public void complete(WorkflowBusinessInstance i, WorkflowCompletion c) {
    var r = validate(i, c.approved());
    String reversal = null;
    if (c.approved()) {
      var invoice = invoices.findByTenantAndId(i.tenantId(), r.invoiceId());
      var original =
          entries.list(i.tenantId(), r.invoiceId()).stream()
              .filter(e -> e.id().equals(r.entryId()))
              .findFirst()
              .orElseThrow();
      reversal = "reversal-" + UUID.randomUUID();
      entries.insert(
          new PaymentEntry(
              reversal,
              i.tenantId(),
              r.invoiceId(),
              "frozen:" + r.id(),
              r.amount().negate(),
              original.milestoneId(),
              r.evidenceNo(),
              r.reason(),
              r.entryId(),
              c.actorId(),
              null));
      installments.reverse(i.tenantId(), invoice.orderId(), r.entryId(), reversal);
      payments.syncAmountPayment(invoice, entries.balance(i.tenantId(), r.invoiceId()), true);
      for (String request : mapper.paymentRequests(i.tenantId(), r.invoiceId()))
        executions.upsertFromPaymentRequest("payexec-" + UUID.randomUUID(), i.tenantId(), request);
    }
    if (mapper.finish(
            i.tenantId(),
            r.id(),
            r.revision(),
            c.approved() ? "approved" : "rejected",
            reversal,
            c.actorId())
        != 1) throw new IllegalStateException("更正申请已变化");
    if (c.approved())
      budget.checkProjectCarryover(i.tenantId(), r.departmentId(), r.targetPeriod(), r.projectId());
    audit.recordTenantAction(
        i.tenantId(),
        "invoice.frozen_correction_" + (c.approved() ? "approved" : "rejected"),
        "invoice",
        r.invoiceId(),
        r.id() + ";原流水:" + r.entryId() + ";反向流水:" + reversal + ";" + c.comment());
  }

  @Transactional
  public Correction withdraw(String invoice, String id, String reason) {
    access.requireInvoice(invoice, "buyer:payment:reverse");
    lock(tenant(), invoice);
    var r = mapper.find(tenant(), id);
    if (r == null || !invoice.equals(r.invoiceId())) throw new IllegalArgumentException("更正申请不存在");
    workflow.withdrawFrozenPaymentCorrection(r.workflowInstanceId(), reason);
    return mapper.find(tenant(), id);
  }

  public void cancel(WorkflowBusinessInstance i, String actor) {
    var r = validate(i, false);
    if (mapper.finish(i.tenantId(), r.id(), r.revision(), "withdrawn", null, actor) != 1)
      throw new IllegalStateException("更正申请已变化");
  }
}
