package com.procurement.finance.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.finance.api.PaymentReviewNoteRequest;
import com.procurement.finance.domain.PaymentReviewNote;
import com.procurement.finance.infrastructure.InvoiceMapper;
import com.procurement.finance.infrastructure.PaymentBatchMapper;
import com.procurement.finance.infrastructure.PaymentRequestMapper;
import com.procurement.finance.infrastructure.PaymentReviewMapper;
import com.procurement.identity.application.PermissionService;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
public class PaymentReviewApplicationService {
  public record Row(String invoiceId, String invoiceNo, String paymentStatus, BigDecimal invoiceAmount,
      BigDecimal ledgerAmount, List<String> findings, long noteCount) {}
  public record Page(List<Row> items, long total, int page, int pageSize) {}
  public record Detail(Row invoice, List<PaymentReviewNote> notes, long totalNotes, int page,
      boolean canRecord) {}

  private final PaymentReviewMapper reviews;
  private final InvoiceMapper invoices;
  private final PaymentRequestMapper requests;
  private final PaymentBatchMapper batches;
  private final PaymentLedgerApplicationService ledger;
  private final FinanceAccessService access;
  private final PaymentApplicationService payments;
  private final PermissionService permissions;
  private final AuditLogApplicationService audit;

  public PaymentReviewApplicationService(PaymentReviewMapper reviews, InvoiceMapper invoices,
      PaymentRequestMapper requests, PaymentBatchMapper batches, PaymentLedgerApplicationService ledger,
      FinanceAccessService access, PaymentApplicationService payments, PermissionService permissions,
      AuditLogApplicationService audit) {
    this.reviews = reviews; this.invoices = invoices; this.requests = requests; this.batches = batches;
    this.ledger = ledger; this.access = access; this.payments = payments; this.permissions = permissions; this.audit = audit;
  }

  public Page list(int page, int pageSize, String keyword, String paymentStatus) {
    validatePage(page, pageSize);
    String search = keyword == null ? "" : keyword.trim();
    String state = paymentStatus == null ? "" : paymentStatus;
    if (search.length() > 100 || !List.of("", "待付款", "部分付款", "已付款").contains(state)) {
      throw new IllegalArgumentException("查询条件无效");
    }
    var scope = access.readScope();
    String tenant = TenantAccessGuard.requireTenantId("payment review");
    long total = reviews.count(tenant, scope, search, state);
    var rows = reviews.page(tenant, scope, search, state, pageSize, (long) (page - 1) * pageSize)
        .stream().map(this::inspect).toList();
    return new Page(rows, total, page, pageSize);
  }

  public Detail detail(String invoiceId, int page) {
    validatePage(page, 10);
    access.requireInvoice(invoiceId, "buyer:invoice:read");
    String tenant = TenantAccessGuard.requireTenantId("payment review");
    return new Detail(inspect(invoiceId), reviews.notes(tenant, invoiceId, 10, (long) (page - 1) * 10),
        reviews.noteCount(tenant, invoiceId), page, permissions.currentUserHas("buyer:payment:reconcile"));
  }

  @Transactional
  public PaymentReviewNote record(String invoiceId, PaymentReviewNoteRequest input) {
    access.requireInvoice(invoiceId, "buyer:payment:reconcile");
    access.requireInvoice(invoiceId, "buyer:invoice:read");
    String tenant = TenantAccessGuard.requireTenantId("payment review");
    String actor = TenantAccessGuard.requireUserId("payment review");
    payments.requireFinanceEnabled(tenant);
    if (invoices.lockByTenantAndId(tenant, invoiceId) == null) throw new IllegalArgumentException("发票不存在");
    String key = input.idempotencyKey().trim();
    String evidence = input.evidenceReference().trim();
    String explanation = input.explanation().trim();
    var previous = reviews.findKey(tenant, invoiceId, key);
    if (previous != null) {
      boolean sameAmount = Objects.equals(previous.reportedPaidAmount(), input.reportedPaidAmount())
          || previous.reportedPaidAmount() != null && input.reportedPaidAmount() != null
            && previous.reportedPaidAmount().compareTo(input.reportedPaidAmount()) == 0;
      if (!sameAmount || !previous.evidenceReference().equals(evidence)
          || !previous.explanation().equals(explanation) || !actor.equals(previous.createdBy())) {
        throw new IllegalStateException("同一提交编号对应的核对内容不同，请重新确认");
      }
      return previous;
    }
    Row current = inspect(invoiceId);
    // Evidence collection is not an opening balance or a substitute for payment approval.
    String snapshot = "状态：" + current.paymentStatus() + "；应付：" + current.invoiceAmount()
        + "；可确认台账金额：" + (current.ledgerAmount() == null ? "待核对" : current.ledgerAmount())
        + "；检查结果：" + (current.findings().isEmpty() ? "本次检查未发现差异" : String.join("；", current.findings()));
    String id = "payreview-" + UUID.randomUUID();
    reviews.insert(new PaymentReviewNote(id, tenant, invoiceId, key, input.reportedPaidAmount(), evidence,
        explanation, snapshot, actor, null));
    audit.recordTenantAction(tenant, "invoice.payment_review_recorded", "invoice", invoiceId,
        "核对记录 " + id + "；凭据 " + evidence + "；未调整付款余额或审批状态");
    return reviews.findKey(tenant, invoiceId, key);
  }

  private Row inspect(String invoiceId) {
    var summary = ledger.summary(invoiceId);
    String tenant = TenantAccessGuard.requireTenantId("payment review");
    var invoice = invoices.findByTenantAndId(tenant, invoiceId);
    var findings = new ArrayList<String>();
    if (summary.reconciliationRequired()) findings.add(summary.warning());
    boolean historical = !summary.entries().isEmpty() || summary.reconciliationRequired()
        || "已付款".equals(invoice.paymentStatus()) || "部分付款".equals(invoice.paymentStatus());
    if (historical) {
      var request = requests.findByTenantAndInvoice(tenant, invoiceId);
      if (request == null || !"付款申请已通过".equals(request.requestStatus())) {
        findings.add("已有付款记录或付款状态，但缺少已通过的付款申请");
      } else {
        if (!Objects.equals(request.orderId(), invoice.orderId()) || !Objects.equals(request.supplierId(), invoice.supplierId())
            || request.amount() == null || request.amount().compareTo(invoice.amount()) != 0) {
          findings.add("付款申请与发票的订单、供应商或金额不一致");
        }
        var batch = batches.findByTenantAndPaymentBatchNo(tenant, request.paymentBatchNo());
        if (batch == null || !("可安排付款".equals(batch.batchStatus()) || "已付款归档".equals(batch.batchStatus()))) {
          findings.add("已有付款记录或付款状态，但缺少已通过的付款批次");
        }
      }
    }
    return new Row(invoiceId, invoice.invoiceNo(), invoice.paymentStatus(), invoice.amount(),
        summary.paidAmount(), findings, reviews.noteCount(tenant, invoiceId));
  }

  private void validatePage(int page, int size) {
    if (page < 1 || size < 1 || size > 25) throw new IllegalArgumentException("页码须大于零，每页最多25条");
  }
}
