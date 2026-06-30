package com.procurement.sourcing.api;

import java.time.OffsetDateTime;
import java.util.List;

public record RfqResponse(
    String id,
    String tenantId,
    String title,
    String status,
    OffsetDateTime deadlineAt,
    String ownerId,
    String awardedSupplierId,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt,
    List<String> demandIds,
    List<String> invitedSupplierIds,
    List<QuoteResponse> quotes,
    String quoteRequirement,
    String deliveryRequirement,
    String evaluationMethod,
    OffsetDateTime openedAt) {

  public RfqResponse(
      String id,
      String tenantId,
      String title,
      String status,
      OffsetDateTime deadlineAt,
      String ownerId,
      String awardedSupplierId,
      OffsetDateTime createdAt,
      OffsetDateTime updatedAt,
      List<String> demandIds,
      List<String> invitedSupplierIds) {
    this(
        id,
        tenantId,
        title,
        status,
        deadlineAt,
        ownerId,
        awardedSupplierId,
        createdAt,
        updatedAt,
        demandIds,
        invitedSupplierIds,
        List.of(),
        "",
        "",
        "最低价",
        null);
  }
}
