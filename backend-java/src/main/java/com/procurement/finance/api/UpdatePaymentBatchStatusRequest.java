package com.procurement.finance.api;

import jakarta.validation.constraints.NotBlank;
import java.util.Map;

public record UpdatePaymentBatchStatusRequest(
    @NotBlank String batchStatus,
    Map<String, Object> formData) {

  public UpdatePaymentBatchStatusRequest(String batchStatus) {
    this(batchStatus, Map.of());
  }
}
