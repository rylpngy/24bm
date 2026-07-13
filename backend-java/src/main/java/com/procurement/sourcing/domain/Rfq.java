package com.procurement.sourcing.domain;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

public record Rfq(
    String id,
    String tenantId,
    String title,
    String status,
    OffsetDateTime deadlineAt,
    String ownerId,
    String awardedSupplierId,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt,
    String quoteRequirement,
    String deliveryRequirement,
    String evaluationMethod,
    OffsetDateTime openedAt,
    int currentRound,
    boolean finalRound,
    String method,
    String closeReason,
    BigDecimal auctionStartPrice,
    BigDecimal auctionMinDecrement,
    String singleSourceReason,
    OffsetDateTime resultAnnouncedAt,
    // 竞价规则配置(V176):保留价(仅内部)/计划开始/软关闭触发与延长(分钟)/供应商可见性。
    BigDecimal auctionReservePrice,
    OffsetDateTime auctionPlannedStart,
    Integer auctionSoftCloseTriggerMinutes,
    Integer auctionSoftCloseExtendMinutes,
    Boolean auctionShowRank,
    Boolean auctionShowLowest,
    Boolean auctionShowCompetitorNames) {
  // 单一(规范)构造器:避免 MyBatis 在多构造器间按 join 查询误选,丢失 currentRound 等新列。
}
