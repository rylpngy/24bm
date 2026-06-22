package com.procurement.supplier.api;

import jakarta.validation.constraints.NotNull;

public record ReviewBuyerSupplierAdmissionRequest(
    @NotNull Boolean approved,
    String comment) {
  public ReviewBuyerSupplierAdmissionRequest(Boolean approved) {
    this(approved, null);
  }
}
