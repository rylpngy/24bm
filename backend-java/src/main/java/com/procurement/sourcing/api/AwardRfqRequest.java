package com.procurement.sourcing.api;

import jakarta.validation.constraints.NotBlank;
import java.util.Map;

public record AwardRfqRequest(
    @NotBlank String quoteId,
    @NotBlank String reason,
    Map<String, Object> formData) {

  public AwardRfqRequest(String quoteId, String reason) {
    this(quoteId, reason, Map.of());
  }
}
