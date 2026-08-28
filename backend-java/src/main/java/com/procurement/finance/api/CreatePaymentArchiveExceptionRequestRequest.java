package com.procurement.finance.api;

import jakarta.validation.constraints.NotBlank;
import java.util.Map;

public record CreatePaymentArchiveExceptionRequestRequest(
    @NotBlank String paymentBatchNo,
    @NotBlank String exceptionType,
    @NotBlank String exceptionReason,
    Map<String, Object> formData) {

  public CreatePaymentArchiveExceptionRequestRequest(
      String paymentBatchNo, String exceptionType, String exceptionReason) {
    this(paymentBatchNo, exceptionType, exceptionReason, Map.of());
  }
}
