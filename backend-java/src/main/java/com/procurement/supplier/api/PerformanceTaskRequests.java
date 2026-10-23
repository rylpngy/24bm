package com.procurement.supplier.api;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;

public final class PerformanceTaskRequests {
  private PerformanceTaskRequests() {}
  public record Create(@NotBlank String period, @NotBlank String assigneeId,
      @NotNull LocalDate dueDate) {}
  public record Evaluate(@NotNull BigDecimal qualityScore, @NotNull BigDecimal deliveryScore,
      @NotNull BigDecimal priceScore, @NotNull BigDecimal serviceScore, @NotBlank @Size(max = 10000) String comment) {}
  public record Remediation(@NotBlank @Size(max = 10000) String requirement,
      @NotNull LocalDate dueDate) {}
  public record Review(@NotNull Boolean approved, @NotBlank @Size(max = 10000) String comment,
      @NotNull @PositiveOrZero Long expectedVersion) {}
  public record Response(@NotBlank @Size(max = 10000) String response,
      @NotNull @PositiveOrZero Long expectedVersion) {}
}
