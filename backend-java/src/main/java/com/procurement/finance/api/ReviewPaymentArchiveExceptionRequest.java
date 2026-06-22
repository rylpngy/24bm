package com.procurement.finance.api;

import jakarta.validation.constraints.NotNull;

public record ReviewPaymentArchiveExceptionRequest(
    @NotNull Boolean approved,
    String comment) {
  public ReviewPaymentArchiveExceptionRequest(Boolean approved) {
    this(approved, null);
  }
}
