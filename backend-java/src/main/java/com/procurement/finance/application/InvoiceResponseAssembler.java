package com.procurement.finance.application;

import com.procurement.finance.api.InvoiceResponse;
import com.procurement.finance.domain.Invoice;
import com.procurement.finance.domain.InvoicePaymentStatus;
import com.procurement.order.domain.PurchaseOrder;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;

final class InvoiceResponseAssembler {
  private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Shanghai");
  private static final long PAYMENT_DUE_DAYS = 30;

  private InvoiceResponseAssembler() {
  }

  static InvoiceResponse from(Invoice invoice, PurchaseOrder order) {
    LocalDate dueDate = invoice.createdAt()
        .atZoneSameInstant(BUSINESS_ZONE)
        .toLocalDate()
        .plusDays(PAYMENT_DUE_DAYS);
    LocalDate today = LocalDate.now(BUSINESS_ZONE);
    boolean overdue = !InvoicePaymentStatus.PAID.equals(invoice.paymentStatus()) && today.isAfter(dueDate);
    long overdueDays = overdue ? ChronoUnit.DAYS.between(dueDate, today) : 0;
    BigDecimal orderAmount = order == null ? null : order.amount();
    BigDecimal varianceAmount = orderAmount == null ? null : invoice.amount().subtract(orderAmount);
    String receiptStatus = order == null
        ? "订单待同步"
        : ("已收货".equals(order.status()) || "已完成".equals(order.status()) ? "已收货" : "待收货");
    String reconciliationStatus = toReconciliationStatus(orderAmount, varianceAmount, receiptStatus);
    String reconciliationStage = toReconciliationStage(invoice.paymentStatus(), reconciliationStatus);
    String nextReconciliationAction = toNextReconciliationAction(reconciliationStage);

    // 价税合计(amount)与税率推导税额与不含税金额：税额 = 价税合计 × 税率 / (100 + 税率)。
    BigDecimal taxRate = invoice.taxRate() == null ? BigDecimal.ZERO : invoice.taxRate();
    BigDecimal taxAmount = invoice.amount()
        .multiply(taxRate)
        .divide(taxRate.add(new BigDecimal("100")), 2, java.math.RoundingMode.HALF_UP);
    BigDecimal netAmount = invoice.amount().subtract(taxAmount);

    return new InvoiceResponse(
        invoice.id(),
        invoice.tenantId(),
        invoice.supplierId(),
        invoice.orderId(),
        invoice.amount(),
        invoice.invoiceNo(),
        invoice.paymentStatus(),
        invoice.reconciliationNote(),
        dueDate,
        overdue,
        overdueDays,
        orderAmount,
        varianceAmount,
        receiptStatus,
        reconciliationStatus,
        "REC-" + invoice.id(),
        reconciliationStage,
        nextReconciliationAction,
        invoice.createdAt(),
        invoice.updatedAt(),
        invoice.invoiceCode(),
        invoice.invoiceDate(),
        taxRate,
        taxAmount,
        netAmount);
  }

  private static String toReconciliationStatus(
      BigDecimal orderAmount,
      BigDecimal varianceAmount,
      String receiptStatus) {
    if (orderAmount == null || varianceAmount == null) {
      return "订单待同步";
    }
    if (varianceAmount.compareTo(BigDecimal.ZERO) != 0) {
      return "金额差异";
    }
    if (!"已收货".equals(receiptStatus)) {
      return "待收货";
    }
    return "三单一致";
  }

  private static String toReconciliationStage(String paymentStatus, String reconciliationStatus) {
    if ("金额差异".equals(reconciliationStatus)) {
      return "差异处理中";
    }
    if ("待收货".equals(reconciliationStatus) || "订单待同步".equals(reconciliationStatus)) {
      return reconciliationStatus;
    }
    if (InvoicePaymentStatus.PAID.equals(paymentStatus)) {
      return "已完成";
    }
    return "待付款";
  }

  private static String toNextReconciliationAction(String reconciliationStage) {
    return switch (reconciliationStage) {
      case "已完成" -> "归档对账";
      case "待付款" -> "登记付款";
      case "差异处理中" -> "处理差异";
      case "待收货" -> "等待收货";
      default -> "同步订单";
    };
  }
}
