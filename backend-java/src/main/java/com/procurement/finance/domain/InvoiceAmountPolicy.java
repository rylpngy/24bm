package com.procurement.finance.domain;

import java.math.BigDecimal;

public final class InvoiceAmountPolicy {
  private InvoiceAmountPolicy() {}

  public static boolean isInstallment(BigDecimal invoiceAmount, BigDecimal orderAmount) {
    return invoiceAmount != null && orderAmount != null
        && invoiceAmount.signum() > 0 && invoiceAmount.compareTo(orderAmount) < 0;
  }

  public static void requireInvoiceCreationAmountMatchesOrder(
      BigDecimal invoiceAmount,
      BigDecimal orderAmount,
      String orderId) {
    if (!matches(invoiceAmount, orderAmount)) {
      throw new IllegalArgumentException("Invoice amount must equal purchase order amount: " + orderId);
    }
  }

  public static void requirePaymentAmountStillMatchesOrder(
      BigDecimal invoiceAmount,
      BigDecimal orderAmount,
      String invoiceId) {
    if (!matches(invoiceAmount, orderAmount)) {
      throw new IllegalStateException("Invoice amount no longer matches purchase order amount: " + invoiceId);
    }
  }

  private static boolean matches(BigDecimal invoiceAmount, BigDecimal orderAmount) {
    return invoiceAmount != null
        && orderAmount != null
        && invoiceAmount.compareTo(orderAmount) == 0;
  }
}
