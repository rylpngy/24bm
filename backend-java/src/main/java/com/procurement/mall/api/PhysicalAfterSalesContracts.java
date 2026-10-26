package com.procurement.mall.api;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

public final class PhysicalAfterSalesContracts {
  private PhysicalAfterSalesContracts() {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "PhysicalAfterSalesAction")
  public record Action(
      @NotBlank @Size(max = 100) String requestKey,
      @NotBlank String kind,
      @NotNull @DecimalMin("0.01") @Digits(integer = 12, fraction = 2) BigDecimal quantity,
      @NotBlank @Size(max = 200) String referenceNo,
      @NotBlank @Size(max = 2000) String note,
      @NotBlank @Size(max = 200) String fileName,
      @NotBlank @Size(max = 2796204) String fileBase64) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "PhysicalAfterSalesEvent")
  public record Event(
      String id,
      String afterSalesId,
      String requestKey,
      String kind,
      BigDecimal quantity,
      String referenceNo,
      String note,
      String fileName,
      String sha256,
      String actorId,
      String actorRole,
      OffsetDateTime createdAt) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "PhysicalAfterSalesView")
  public record View(
      String stage, List<String> actions, List<Event> events, String financialStatus) {}

  public record File(byte[] bytes, String fileName, String sha256) {}
}
