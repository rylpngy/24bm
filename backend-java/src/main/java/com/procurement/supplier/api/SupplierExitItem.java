package com.procurement.supplier.api;

import java.math.BigDecimal;

public record SupplierExitItem(String id, String orderId, String invoiceId, String label,
    String status, BigDecimal amount, BigDecimal invoicedAmount, BigDecimal paidAmount,
    BigDecimal remainingAmount, String reason, String handlerLabel) {}
