package com.procurement.contract.api;

import jakarta.validation.constraints.NotNull;

public record ReviewContractApprovalRequest(
    @NotNull Boolean approved,
    String comment) {
  public ReviewContractApprovalRequest(Boolean approved) {
    this(approved, null);
  }
}
