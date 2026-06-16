package com.procurement.finance.domain;

import org.springframework.stereotype.Component;

@Component
public class InvoicePaymentStatusTransition {

  public boolean isSupportedTarget(String paymentStatus) {
    return InvoicePaymentStatus.PAID.equals(paymentStatus)
        || InvoicePaymentStatus.PARTIAL_PAID.equals(paymentStatus);
  }

  public boolean isIdempotentRegistration(String currentStatus, String targetStatus) {
    return currentStatus.equals(targetStatus)
        && (InvoicePaymentStatus.PAID.equals(currentStatus)
            || InvoicePaymentStatus.PARTIAL_PAID.equals(currentStatus));
  }

  public void requireTransition(String currentStatus, String targetStatus, String invoiceId) {
    if (InvoicePaymentStatus.PENDING_PAYMENT.equals(currentStatus)) {
      return;
    }
    if (InvoicePaymentStatus.PARTIAL_PAID.equals(currentStatus)
        && InvoicePaymentStatus.PAID.equals(targetStatus)) {
      return;
    }
    if (InvoicePaymentStatus.PAID.equals(currentStatus)) {
      throw new IllegalStateException("Paid invoices cannot be changed: " + invoiceId);
    }
    throw new IllegalStateException(
        "Unsupported payment status transition: " + currentStatus + " -> " + targetStatus);
  }
}
