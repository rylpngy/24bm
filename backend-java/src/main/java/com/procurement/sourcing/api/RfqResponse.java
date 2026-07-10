package com.procurement.sourcing.api;

import java.math.BigDecimal;
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
    OffsetDateTime openedAt,
    int currentRound,
    boolean finalRound,
    String method,
    String closeReason,
    // 竞价专属:起拍价 / 最小降价步长 / 当前轮最低报价(仅竞价方式返回,供出价参考)。
    BigDecimal auctionStartPrice,
    BigDecimal auctionMinDecrement,
    BigDecimal auctionLowestAmount) {

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
        null,
        1,
        false,
        "询比",
        null,
        null,
        null,
        null);
  }
}
