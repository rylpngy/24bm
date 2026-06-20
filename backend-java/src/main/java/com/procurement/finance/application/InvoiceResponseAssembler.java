package com.procurement.finance.application;

import com.procurement.finance.api.InvoiceResponse;
import com.procurement.finance.domain.Invoice;
import com.procurement.finance.domain.InvoicePaymentStatus;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;

final class InvoiceResponseAssembler {
  private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Shanghai");
  private static final long PAYMENT_DUE_DAYS = 30;

  private InvoiceResponseAssembler() {
  }

  static InvoiceResponse from(Invoice invoice) {
    LocalDate dueDate = invoice.createdAt()
        .atZoneSameInstant(BUSINESS_ZONE)
        .toLocalDate()
        .plusDays(PAYMENT_DUE_DAYS);
    LocalDate today = LocalDate.now(BUSINESS_ZONE);
    boolean overdue = !InvoicePaymentStatus.PAID.equals(invoice.paymentStatus()) && today.isAfter(dueDate);
    long overdueDays = overdue ? ChronoUnit.DAYS.between(dueDate, today) : 0;

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
        invoice.createdAt(),
        invoice.updatedAt());
  }
}
