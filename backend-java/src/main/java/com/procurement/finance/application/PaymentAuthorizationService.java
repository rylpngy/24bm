package com.procurement.finance.application;

import com.procurement.contract.application.ContractPaymentPolicyService;
import com.procurement.finance.domain.Invoice;
import com.procurement.finance.domain.PaymentRequest;
import com.procurement.finance.domain.PaymentBatchStatus;
import com.procurement.finance.infrastructure.PaymentRequestMapper;
import com.procurement.finance.infrastructure.PaymentBatchMapper;
import com.procurement.finance.infrastructure.PaymentExecutionRecordMapper;
import com.procurement.finance.infrastructure.ThreeWayMatchMapper;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PaymentAuthorizationService {
  private final PaymentRequestMapper requests;
  private final PaymentBatchMapper batches;
  private final PaymentExecutionRecordMapper executions;
  private final ThreeWayMatchMapper matches;
  private final FinanceAccessService access;
  private final ContractPaymentPolicyService contracts;
  private final com.procurement.finance.infrastructure.InvoiceMapper invoices;
  private final com.procurement.finance.infrastructure.PaymentEntryMapper entries;
  private final com.procurement.contract.application.ContractInstallmentService installments;

  public PaymentAuthorizationService(PaymentRequestMapper requests, PaymentBatchMapper batches,
      PaymentExecutionRecordMapper executions, ThreeWayMatchMapper matches,
      FinanceAccessService access, ContractPaymentPolicyService contracts,
      com.procurement.finance.infrastructure.InvoiceMapper invoices,
      com.procurement.finance.infrastructure.PaymentEntryMapper entries,
      com.procurement.contract.application.ContractInstallmentService installments) {
    this.requests = requests;
    this.batches = batches;
    this.executions = executions;
    this.matches = matches;
    this.access = access;
    this.contracts = contracts;
    this.invoices = invoices;
    this.entries = entries;
    this.installments = installments;
  }

  @Transactional(propagation = Propagation.MANDATORY)
  public PaymentRequest requireReady(Invoice invoice, String targetStatus) {
    var locked = invoices.lockByTenantAndId(invoice.tenantId(), invoice.id());
    if (locked == null || !locked.paymentStatus().equals(invoice.paymentStatus())) {
      throw new IllegalStateException("付款状态已变化，请刷新重试");
    }
    requireKnownBalance(invoice, entries.balance(invoice.tenantId(), invoice.id()));
    if (!"已付款".equals(targetStatus)) {
      throw new IllegalStateException("部分付款必须填写实际金额，请使用付款金额台账登记");
    }
    var request = requireApproved(invoice, true);
    contracts.requirePaymentReady(invoice.tenantId(), invoice.orderId(), invoice.supplierId(), invoice.amount(), true);
    return request;
  }

  @Transactional(propagation = Propagation.MANDATORY)
  public PaymentRequest requireApproved(Invoice invoice, boolean checkMatch) {
    String tenant = invoice.tenantId();
    var request = requests.lockByTenantAndInvoice(tenant, invoice.id());
    if (request == null || !"付款申请已通过".equals(request.requestStatus())) {
      throw new IllegalStateException("请先提交付款申请并完成审批，再登记付款");
    }
    if (!invoice.orderId().equals(request.orderId()) || !invoice.supplierId().equals(request.supplierId())
        || request.amount() == null || request.amount().compareTo(invoice.amount()) != 0) {
      throw new IllegalStateException("付款申请与当前发票的订单、供应商或金额不一致");
    }
    access.requireBatch(request.paymentBatchNo(), "buyer:payment:register");
    if (!PaymentBatchStatus.READY_FOR_PAYMENT.equals(batches.lockStatus(tenant, request.paymentBatchNo()))) {
      throw new IllegalStateException("付款批次尚未审批通过或已归档，不能登记付款");
    }
    if (!checkMatch) return request;
    matches.upsertFromInvoice("match-" + UUID.randomUUID(), tenant, invoice.id());
    var current = matches.listByTenantFiltered(tenant, null, null, null, invoice.id());
    if (current.size() != 1 || !"三单匹配通过".equals(current.getFirst().matchStatus())) {
      throw new IllegalStateException("订单、收货和发票尚未匹配通过，请先核对");
    }
    return request;
  }

  @Transactional(propagation = Propagation.MANDATORY)
  public void recordPayment(Invoice invoice, PaymentRequest request, String evidence, String remark) {
    String id = "payment-" + UUID.randomUUID();
    var amount = invoice.amount().subtract(entries.balance(invoice.tenantId(), invoice.id()));
    entries.insert(new com.procurement.finance.domain.PaymentEntry(id, invoice.tenantId(), invoice.id(),
        "legacy-" + UUID.randomUUID(), amount, null, evidence == null ? "" : evidence.trim(),
        remark == null || remark.isBlank() ? "兼容状态接口全额登记" : remark.trim(), null,
        com.procurement.common.tenant.TenantAccessGuard.requireUserId("payment registration"), null));
    installments.allocate(invoice.tenantId(), invoice.orderId(), invoice.supplierId(), invoice.amount(), id, amount, null, invoice.amount().subtract(amount));
    executions.upsertFromPaymentRequest("payexec-" + UUID.randomUUID(), invoice.tenantId(), request.id());
  }

  public static void requireKnownBalance(Invoice invoice, java.math.BigDecimal paid) {
    if (paid.signum() < 0 || paid.compareTo(invoice.amount()) > 0 || !status(paid, invoice.amount()).equals(invoice.paymentStatus())) {
      throw new IllegalStateException("历史付款状态与金额流水不一致，请先核对实际付款，不能推算或重复登记");
    }
  }

  public static String status(java.math.BigDecimal paid, java.math.BigDecimal due) {
    return paid.signum() == 0 ? "待付款" : paid.compareTo(due) == 0 ? "已付款" : "部分付款";
  }
}
