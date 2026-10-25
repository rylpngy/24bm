package com.procurement.finance.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.contract.application.ContractInstallmentService;
import com.procurement.finance.api.RecordPaymentAmountRequest;
import com.procurement.finance.api.ReversePaymentRequest;
import com.procurement.finance.domain.Invoice;
import com.procurement.finance.domain.PaymentEntry;
import com.procurement.finance.infrastructure.InvoiceMapper;
import com.procurement.finance.infrastructure.PaymentEntryMapper;
import com.procurement.finance.infrastructure.PaymentExecutionRecordMapper;
import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PaymentLedgerApplicationService {
  public record Summary(BigDecimal invoiceAmount, BigDecimal paidAmount, BigDecimal remainingAmount,
      boolean reconciliationRequired, String warning, List<PaymentEntry> entries,
      List<ContractInstallmentService.Balance> milestones) {}

  private final InvoiceMapper invoices;
  private final PaymentEntryMapper entries;
  private final FinanceAccessService access;
  private final PaymentAuthorizationService authorization;
  private final PaymentApplicationService payments;
  private final ContractInstallmentService installments;
  private final PaymentExecutionRecordMapper executions;
  private final AuditLogApplicationService audit;

  public PaymentLedgerApplicationService(InvoiceMapper invoices, PaymentEntryMapper entries,
      FinanceAccessService access, PaymentAuthorizationService authorization, PaymentApplicationService payments,
      ContractInstallmentService installments, PaymentExecutionRecordMapper executions, AuditLogApplicationService audit) {
    this.invoices = invoices; this.entries = entries; this.access = access; this.authorization = authorization;
    this.payments = payments; this.installments = installments; this.executions = executions; this.audit = audit;
  }

  @Transactional(readOnly = true, isolation = org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
  public Summary summary(String invoiceId) {
    access.requireInvoice(invoiceId, "buyer:invoice:read");
    return summarize(invoices.findByTenantAndId(TenantAccessGuard.requireTenantId("payment ledger"), invoiceId));
  }

  private Summary summarize(Invoice invoice) {
    BigDecimal paid = entries.balance(invoice.tenantId(), invoice.id());
    var schedule = installments.balances(invoice.tenantId(), invoice.orderId());
    String warning = "";
    try { PaymentAuthorizationService.requireKnownBalance(invoice, paid); }
    catch (IllegalStateException e) { warning = e.getMessage(); }
    if (schedule.stream().anyMatch(m -> !m.verified())) warning = "历史合同付款缺少金额流水或计划已变更，请先核对";
    if (!schedule.isEmpty() && schedule.stream().allMatch(m -> m.verified())
        && schedule.stream().map(ContractInstallmentService.Balance::paid).reduce(BigDecimal.ZERO, BigDecimal::add).compareTo(paid) != 0) {
      warning = "合同已分配金额与发票付款流水不一致，请先核对付款计划";
    }
    boolean unknown = !warning.isEmpty();
    return new Summary(invoice.amount(), unknown ? null : paid, unknown ? null : invoice.amount().subtract(paid),
        unknown, warning, entries.list(invoice.tenantId(), invoice.id()), schedule);
  }

  @Transactional
  public Summary record(String invoiceId, RecordPaymentAmountRequest input) {
    Invoice invoice = lock(invoiceId, "buyer:payment:register");
    String key = input.idempotencyKey().trim();
    String milestone = clean(input.milestoneId());
    String evidence = input.evidenceNo().trim();
    String remark = input.remark() == null ? "" : input.remark().trim();
    var previous = entries.findKey(invoice.tenantId(), invoiceId, key);
    if (previous != null) {
      if (previous.reversalOf() != null || previous.amount().compareTo(input.amount()) != 0
          || !Objects.equals(previous.milestoneId(), milestone) || !previous.evidenceNo().equals(evidence)
          || !previous.remark().equals(remark)) throw new IllegalStateException("同一提交编号对应的付款内容不同，请核对后重新提交");
      return summarize(invoice);
    }
    BigDecimal paid = entries.balance(invoice.tenantId(), invoiceId);
    PaymentAuthorizationService.requireKnownBalance(invoice, paid);
    payments.validateAmountPayment(invoice);
    var approved = authorization.requireApproved(invoice, true);
    BigDecimal next = paid.add(input.amount());
    if (input.amount().signum() <= 0 || next.compareTo(invoice.amount()) > 0) {
      throw new IllegalStateException("本次付款不得超过剩余应付金额：" + invoice.amount().subtract(paid).toPlainString());
    }
    String id = "payment-" + UUID.randomUUID();
    entries.insert(new PaymentEntry(id, invoice.tenantId(), invoiceId, key, input.amount(), milestone,
        evidence, remark, null, TenantAccessGuard.requireUserId("payment ledger"), null));
    installments.allocate(invoice.tenantId(), invoice.orderId(), invoice.supplierId(), invoice.amount(), id, input.amount(), milestone, paid);
    payments.syncAmountPayment(invoice, next, false);
    executions.upsertFromPaymentRequest("payexec-" + UUID.randomUUID(), invoice.tenantId(), approved.id());
    audit.recordTenantAction(invoice.tenantId(), "invoice.payment_amount_registered", "invoice", invoiceId,
        "流水 " + id + "；本次 " + input.amount().toPlainString() + "；累计 " + next.toPlainString() + "；凭据 " + evidence);
    return summarize(invoices.findByTenantAndId(invoice.tenantId(), invoiceId));
  }

  @Transactional
  public Summary reverse(String invoiceId, String entryId, ReversePaymentRequest input) {
    Invoice invoice = lock(invoiceId, "buyer:payment:reverse");
    var original = entries.list(invoice.tenantId(), invoiceId).stream().filter(e -> e.id().equals(entryId)).findFirst()
        .orElseThrow(() -> new IllegalArgumentException("付款流水不存在"));
    var previous = entries.findKey(invoice.tenantId(), invoiceId, input.idempotencyKey().trim());
    if (previous != null) {
      if (!entryId.equals(previous.reversalOf()) || !input.reason().trim().equals(previous.remark())) {
        throw new IllegalStateException("同一提交编号对应的冲销内容不同");
      }
      return summarize(invoice);
    }
    if (original.amount().signum() <= 0 || entries.list(invoice.tenantId(), invoiceId).stream().anyMatch(e -> entryId.equals(e.reversalOf()))) {
      throw new IllegalStateException("只能冲销未冲销的原付款记录，不能重复冲销或冲销负数记录");
    }
    if(invoices.carriedPayment(invoice.tenantId(),invoiceId,entryId))throw new IllegalStateException("该付款已纳入跨年度承接审批依据，不能直接冲销历史支出；跨年度更正需另行审批处理，当前不提供直接更正入口");
    BigDecimal paid = entries.balance(invoice.tenantId(), invoiceId);
    PaymentAuthorizationService.requireKnownBalance(invoice, paid);
    var approved = authorization.requireApproved(invoice, false);
    String id = "reversal-" + UUID.randomUUID();
    entries.insert(new PaymentEntry(id, invoice.tenantId(), invoiceId, input.idempotencyKey().trim(), original.amount().negate(),
        original.milestoneId(), original.evidenceNo(), input.reason().trim(), entryId, TenantAccessGuard.requireUserId("payment ledger"), null));
    installments.reverse(invoice.tenantId(), invoice.orderId(), entryId, id);
    BigDecimal next = paid.subtract(original.amount());
    if (next.signum() < 0) throw new IllegalStateException("冲销后累计金额不能为负数");
    payments.syncAmountPayment(invoice, next, true);
    executions.upsertFromPaymentRequest("payexec-" + UUID.randomUUID(), invoice.tenantId(), approved.id());
    audit.recordTenantAction(invoice.tenantId(), "invoice.payment_reversed", "invoice", invoiceId,
        "冲销 " + entryId + "；金额 " + original.amount().toPlainString() + "；原因 " + input.reason().trim());
    return summarize(invoices.findByTenantAndId(invoice.tenantId(), invoiceId));
  }

  private Invoice lock(String invoiceId, String permission) {
    access.requireInvoice(invoiceId, permission);
    String tenant = TenantAccessGuard.requireTenantId("payment ledger");
    String order = invoices.lockOrderForInvoice(tenant, invoiceId);
    if (order == null) throw new IllegalArgumentException("发票关联订单不存在");
    if(invoices.projectLiquidated(tenant,invoiceId))throw new IllegalStateException("项目已完成终止清算，不能新增付款或冲销清算依据；须先办理经审批的清算更正");
    var invoice = invoices.lockByTenantAndId(tenant, invoiceId);
    if (invoice == null) throw new IllegalArgumentException("发票不存在");
    if (!order.equals(invoice.orderId())) throw new IllegalStateException("发票关联订单已变化，请刷新重试");
    payments.requireFinanceEnabled(invoice.tenantId());
    return invoice;
  }

  private String clean(String value) { return value == null || value.isBlank() ? null : value.trim(); }
}
