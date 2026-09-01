package com.procurement.finance.api;

import jakarta.validation.constraints.NotBlank;
import java.util.Map;

public record UpdatePaymentRequestStatusRequest(
    @NotBlank String requestStatus,
    Map<String, Object> formData) {

  public UpdatePaymentRequestStatusRequest(String requestStatus) {
    this(requestStatus, Map.of());
  }
}
