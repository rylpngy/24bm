package com.procurement.order.api;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

public final class ReceiptQualityContracts {
  private ReceiptQualityContracts() {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "ReceiptQualityRequest")
  public record Request(
      @NotBlank String receiptLineId,
      @NotBlank String afterSalesId,
      @NotBlank @Size(max = 2000) String reason) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "ReceiptQualityLine")
  public record Line(
      String receiptLineId,
      String orderLineId,
      String description,
      BigDecimal receivedQuantity,
      BigDecimal qualifiedQuantity,
      BigDecimal returnedQuantity,
      BigDecimal exchangedQuantity,
      BigDecimal unresolvedQuantity,
      boolean valid) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "ReceiptQualityCandidate")
  public record Candidate(
      String afterSalesId,
      String orderLineId,
      String kind,
      BigDecimal quantity,
      String physicalEventId,
      String physicalSha256) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "ReceiptQualityResolution")
  public record Resolution(
      String id,
      String receiptLineId,
      String afterSalesId,
      BigDecimal quantity,
      String kind,
      String physicalEventId,
      String physicalSha256,
      String fileName,
      String reason,
      String reviewedBy,
      OffsetDateTime reviewedAt) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "ReceiptQualityView")
  public record View(
      String receiptId,
      String orderId,
      List<Line> lines,
      List<Candidate> candidates,
      List<Resolution> resolutions,
      boolean canResolve,
      String boundary) {}
}
