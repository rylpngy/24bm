package com.procurement.finance.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.finance.api.*;
import com.procurement.finance.domain.InvoiceInstallmentPolicy;
import com.procurement.finance.infrastructure.*;
import com.procurement.identity.application.PermissionService;
import com.procurement.order.domain.PurchaseOrder;
import com.procurement.tenant.application.TenantFeatureApplicationService;
import com.procurement.tenant.domain.TenantFeatureKey;
import java.math.*;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InvoiceInstallmentService {
  private final InvoiceIssuanceMapper mapper;
  private final InvoiceMapper invoices;
  private final InvoiceLineItemMapper lines;
  private final PermissionService permissions;
  private final TenantFeatureApplicationService features;

  public InvoiceInstallmentService(
      InvoiceIssuanceMapper mapper,
      InvoiceMapper invoices,
      InvoiceLineItemMapper lines,
      PermissionService permissions,
      TenantFeatureApplicationService features) {
    this.mapper = mapper;
    this.invoices = invoices;
    this.lines = lines;
    this.permissions = permissions;
    this.features = features;
  }

  @Transactional(
      readOnly = true,
      isolation = org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
  public InvoiceIssuancePreview preview(String order) {
    permissions.require("supplier:invoice:read");
    var o = mapper.order(TenantAccessGuard.requireSupplierId("invoice issuance"), order);
    if (o == null) throw new IllegalArgumentException("订单不存在或不属于当前供应商");
    features.requireHistoricalFulfillment(o.tenantId(), TenantFeatureKey.FINANCE);
    return inspect(o, o.status());
  }

  private InvoiceIssuancePreview inspect(PurchaseOrder o, String status) {
    var facts = mapper.balances(o.tenantId(), o.id());
    var errors = new ArrayList<String>();
    if (!"已收货".equals(status)) errors.add("订单足额收货验收后方可分次开票");
    if (facts.isEmpty()
        || facts.stream()
            .anyMatch(
                l ->
                    l.quantity().signum() <= 0
                        || l.unitPrice().signum() < 0
                        || l.quantity()
                                .multiply(l.unitPrice())
                                .setScale(2, RoundingMode.HALF_UP)
                                .compareTo(l.lineAmount())
                            != 0)
        || facts.stream()
                .map(InvoiceInstallmentPolicy.Balance::lineAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .compareTo(o.amount())
            != 0) errors.add("原订单明细或金额缺失/不一致，请先核验");
    if (mapper.invalidHistory(o.tenantId(), o.id())
        || facts.stream()
            .anyMatch(
                l ->
                    l.invoicedQuantity().signum() < 0
                        || l.invoicedQuantity().compareTo(l.quantity()) > 0
                        || l.invoicedAmount().signum() < 0
                        || l.invoicedAmount().compareTo(l.lineAmount()) > 0))
      errors.add("历史发票行或累计开票数量/金额无法核对，暂停续开");
    BigDecimal billed = mapper.invoiced(o.tenantId(), o.id());
    if (billed.signum() < 0 || billed.compareTo(o.amount()) > 0) errors.add("累计开票金额超出订单范围");
    if (billed.compareTo(o.amount()) == 0) errors.add("本订单已足额开票");
    return new InvoiceIssuancePreview(
        o.id(),
        o.amount(),
        billed,
        o.amount().subtract(billed).max(BigDecimal.ZERO),
        facts.stream()
            .map(
                l ->
                    new InvoiceIssuancePreview.Line(
                        l.id(),
                        l.description(),
                        l.unit(),
                        l.quantity(),
                        l.unitPrice(),
                        l.invoicedQuantity(),
                        l.quantity().subtract(l.invoicedQuantity()).max(BigDecimal.ZERO)))
            .toList(),
        List.copyOf(errors));
  }

  public record Issued(String id, boolean created) {}

  @Transactional
  public Issued issue(PurchaseOrder o, CreateInvoiceRequest r) {
    permissions.require("supplier:invoice:manage");
    if (!o.supplierId().equals(TenantAccessGuard.requireSupplierId("invoice issuance")))
      throw new IllegalArgumentException("订单供应商范围不符");
    features.requireEnabled(o.tenantId(), TenantFeatureKey.FINANCE);
    String status = invoices.lockOrder(o.tenantId(), o.id());
    if (r.requestKey() == null || r.requestKey().isBlank() || r.requestKey().length() > 100)
      throw new IllegalArgumentException("分次开票须提供有效提交编号");
    String fingerprint = fingerprint(r);
    var old = mapper.byKey(o.tenantId(), o.supplierId(), o.id(), r.requestKey());
    if (old != null) {
      if (!fingerprint.equals(old.fingerprint())) throw new IllegalStateException("同一开票提交编号内容不同");
      return new Issued(old.id(), false);
    }
    var preview = inspect(o, status);
    if (!preview.blockers().isEmpty())
      throw new IllegalStateException(String.join("；", preview.blockers()));
    if (r.invoiceNo() == null
        || r.invoiceNo().isBlank()
        || mapper.duplicateNumber(o.tenantId(), o.id(), r.invoiceNo().strip()))
      throw new IllegalArgumentException("发票号码为空或本订单已登记该号码");
    var chosen =
        InvoiceInstallmentPolicy.select(
            mapper.balances(o.tenantId(), o.id()),
            r.lineItems().stream()
                .map(l -> new InvoiceInstallmentPolicy.Selection(l.orderLineId(), l.quantity()))
                .toList(),
            r.amount());
    if (r.amount().compareTo(preview.remainingAmount()) > 0)
      throw new IllegalArgumentException("本次金额超过剩余可开金额");
    if (r.amount().compareTo(preview.remainingAmount()) == 0
        && preview.lines().stream()
            .anyMatch(
                l ->
                    chosen.stream()
                            .filter(x -> x.original().id().equals(l.orderLineId()))
                            .map(InvoiceInstallmentPolicy.IssuedLine::quantity)
                            .reduce(BigDecimal.ZERO, BigDecimal::add)
                            .compareTo(l.remainingQuantity())
                        != 0)) throw new IllegalArgumentException("末次开票须覆盖全部剩余订单行，包含零单价物料");
    String id = "invoice-" + UUID.randomUUID();
    invoices.insert(
        id,
        o.tenantId(),
        o.supplierId(),
        o.id(),
        r.amount(),
        r.invoiceNo().strip(),
        "待付款",
        r.invoiceCode() == null ? "" : r.invoiceCode().strip(),
        r.invoiceDate() == null ? LocalDate.now(ZoneId.of("Asia/Shanghai")) : r.invoiceDate(),
        r.taxRate() == null ? new BigDecimal("13") : r.taxRate());
    if (mapper.submission(o.tenantId(), id, r.requestKey(), fingerprint) != 1)
      throw new IllegalStateException("开票提交绑定失败");
    int sort = 0;
    for (var l : chosen)
      lines.insert(
          "ili-" + UUID.randomUUID(),
          o.tenantId(),
          id,
          l.original().id(),
          l.original().description(),
          l.original().unit(),
          l.quantity(),
          l.original().unitPrice(),
          l.amount(),
          sort++);
    return new Issued(id, true);
  }

  private String fingerprint(CreateInvoiceRequest r) {
    try {
      var values = new ArrayList<Object>();
      values.add(r.amount() == null ? null : r.amount().stripTrailingZeros().toPlainString());
      values.add(r.invoiceNo() == null ? null : r.invoiceNo().strip());
      values.add(r.invoiceCode() == null ? "" : r.invoiceCode().strip());
      values.add(r.invoiceDate() == null ? null : r.invoiceDate().toString());
      values.add(
          (r.taxRate() == null ? new BigDecimal("13") : r.taxRate())
              .stripTrailingZeros()
              .toPlainString());
      values.add(
          r.lineItems().stream()
              .sorted(Comparator.comparing(CreateInvoiceRequest.Line::orderLineId))
              .map(l -> List.of(l.orderLineId(), l.quantity().stripTrailingZeros().toPlainString()))
              .toList());
      return java.util.HexFormat.of()
          .formatHex(
              java.security.MessageDigest.getInstance("SHA-256")
                  .digest(new ObjectMapper().writeValueAsBytes(values)));
    } catch (Exception e) {
      throw new IllegalArgumentException("开票明细格式无效", e);
    }
  }
}
