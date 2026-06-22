package com.procurement.sourcing.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record ReviewAwardApprovalRequest(
    @NotBlank String awardId,
    @NotNull Boolean approved,
    String comment) {
  public ReviewAwardApprovalRequest(String awardId, Boolean approved) {
    this(awardId, approved, null);
  }
}
