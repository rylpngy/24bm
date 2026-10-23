package com.procurement.supplier.api;

import java.math.BigDecimal;

public record SupplierExitRiskResponse(int unreceivedOrderCount, int unpaidInvoiceCount,
    BigDecimal unpaidInvoiceFaceAmount) {}
