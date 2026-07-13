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
    BigDecimal auctionLowestAmount,
    String singleSourceReason,
    // 受邀方参与状态:采购方视角全量;供应商视角仅返回本方记录。
    List<RfqInvitationResponse> invitations,
    OffsetDateTime resultAnnouncedAt,
    // 竞价规则配置;保留价仅采购方可见(供应商侧置空)。
    BigDecimal auctionReservePrice,
    OffsetDateTime auctionPlannedStart,
    Integer auctionSoftCloseTriggerMinutes,
    Integer auctionSoftCloseExtendMinutes,
    Boolean auctionShowRank,
    Boolean auctionShowLowest,
    Boolean auctionShowCompetitorNames,
    // 供应商视角:开启显示排名时返回本方当前名次(1=领先);其余场景为 null。
    Integer auctionMyRank) {

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
        null,
        null,
        List.of(),
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null);
  }
}
