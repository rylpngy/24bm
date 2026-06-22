package com.procurement.finance.api;

import jakarta.validation.constraints.NotBlank;

public record CreatePaymentRequestRequest(
    @NotBlank String invoiceId,
    @NotBlank String requestStatus,
    @NotBlank String paymentBatchNo,
    String remark) {
}
