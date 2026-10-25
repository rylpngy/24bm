package com.procurement.buyer.api;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.List;

public final class ProjectMallContracts {
  private ProjectMallContracts() {}

  @Schema(name = "ProjectMallSkuInput")
  public record Item(
      @NotBlank String skuId,
      @NotNull @DecimalMin(value = "0", inclusive = false) BigDecimal quantity) {}

  @Schema(name = "ProjectMallCheckoutRequest")
  public record Checkout(
      @Min(1) int revision,
      @NotBlank @Size(max = 100) String requestKey,
      @NotBlank @Size(max = 1000) String reason,
      @NotEmpty @Size(max = 100) List<@NotNull @Valid Item> items,
      LocalDate expectedReceiptDate,
      String addressId) {}

  @Schema(name = "ProjectMallSelection")
  public record Selection(
      String projectId,
      String packageId,
      String rfqId,
      String orderId,
      String requestKey,
      String requestHash,
      String snapshot,
      String reason,
      String actorId,
      OffsetDateTime createdAt) {}
}
