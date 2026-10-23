package com.procurement.supplier.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChangeBuyerSupplierStatusRequest(@NotBlank String status, @Size(max = 2000) String reason) {
  public ChangeBuyerSupplierStatusRequest(String status) { this(status, null); }
}
