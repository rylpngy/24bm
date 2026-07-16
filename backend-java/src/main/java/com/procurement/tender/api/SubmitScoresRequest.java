package com.procurement.tender.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.List;

public record SubmitScoresRequest(@NotBlank String evaluatorId, @NotEmpty @Valid List<Line> lines) {
  public record Line(
      @NotBlank String bidId,
      @NotNull BigDecimal technicalScore,
      @NotNull BigDecimal commercialScore,
      String comment) {
  }
}
