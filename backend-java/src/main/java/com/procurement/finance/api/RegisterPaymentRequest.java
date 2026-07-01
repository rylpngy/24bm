package com.procurement.finance.api;

import jakarta.validation.constraints.NotBlank;

public record RegisterPaymentRequest(
    @NotBlank String paymentStatus,
    String releaseEvidenceNo,
    String releaseRemark) {
  public RegisterPaymentRequest(String paymentStatus) {
    this(paymentStatus, null, null);
  }
}
