package com.procurement.demand.api;

import jakarta.validation.constraints.NotNull;

public record ReviewPurchaseDemandRequest(
    @NotNull Boolean approved,
    String comment) {
  public ReviewPurchaseDemandRequest(Boolean approved) {
    this(approved, null);
  }
}
