package com.procurement.supplier.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record ChangeBuyerSupplierProfileRequest(
    @NotBlank String level,
    @NotNull List<String> categories,
    String creditCode,
    String legalPerson,
    String contactName,
    String contactPhone,
    String contactEmail,
    String businessScope,
    String bankName,
    String bankAccount) {
  public ChangeBuyerSupplierProfileRequest(String level, List<String> categories) {
    this(level, categories, null, null, null, null, null, null, null, null);
  }
}
