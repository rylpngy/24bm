package com.procurement.supplier.api;

import java.math.BigDecimal;

public record SupplierExitRiskResponse(int unreceivedOrderCount, int unpaidInvoiceCount,
    BigDecimal unpaidInvoiceFaceAmount, int unarchivedContractCount, int openAfterSalesCount,
    int uninvoicedOrderCount, int paymentVerificationRequiredCount,
    BigDecimal remainingInvoiceAmount, boolean blocked) {
  @org.apache.ibatis.annotations.AutomapConstructor
  public SupplierExitRiskResponse {}

  public SupplierExitRiskResponse(int unreceivedOrderCount, int unpaidInvoiceCount,
      BigDecimal unpaidInvoiceFaceAmount) {
    this(unreceivedOrderCount, unpaidInvoiceCount, unpaidInvoiceFaceAmount, 0, 0, 0,
        unpaidInvoiceCount > 0 ? unpaidInvoiceCount : 0,
        unpaidInvoiceCount > 0 ? null : BigDecimal.ZERO,
        unreceivedOrderCount > 0 || unpaidInvoiceCount > 0);
  }
}
