package com.procurement.finance.api;

import jakarta.validation.constraints.NotBlank;
import java.util.Map;

public record CreatePaymentRequestRequest(
    @NotBlank String invoiceId,
    @NotBlank String requestStatus,
    @NotBlank String paymentBatchNo,
    String remark,
    Map<String, Object> formData) {

  public CreatePaymentRequestRequest(
      String invoiceId, String requestStatus, String paymentBatchNo, String remark) {
    this(invoiceId, requestStatus, paymentBatchNo, remark, Map.of());
  }
}
