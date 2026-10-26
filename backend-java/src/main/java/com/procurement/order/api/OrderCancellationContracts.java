package com.procurement.order.api;

import jakarta.validation.constraints.*;
import java.time.OffsetDateTime;
import java.util.List;

public final class OrderCancellationContracts {
  @io.swagger.v3.oas.annotations.media.Schema(name = "OrderCancellationRequest")
  public record Request(
      @NotBlank @Size(max = 100) String requestKey, @NotBlank @Size(max = 1000) String reason) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "OrderCancellationDecision")
  public record Decision(
      @NotBlank @Pattern(regexp = "accept|reject|withdraw") String action,
      @NotBlank @Size(max = 1000) String reason) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "OrderCancellationEntry")
  public record Entry(
      String id,
      String orderId,
      String status,
      String reason,
      String previousStatus,
      String createdBy,
      OffsetDateTime createdAt,
      String completedBy,
      OffsetDateTime completedAt,
      String response) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "OrderCancellationView")
  public record View(
      List<String> blockers, List<Entry> items, long total, int page, int size, String actorId) {}
}
