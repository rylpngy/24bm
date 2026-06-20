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
        invoice.createdAt(),
        invoice.updatedAt());
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
}
