package com.procurement.sourcing.domain;

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
    OffsetDateTime openedAt) {

  // 旧构造点便捷重载(开标时间默认空=封存)。
  public Rfq(
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
      String evaluationMethod) {
    this(id, tenantId, title, status, deadlineAt, ownerId, awardedSupplierId, createdAt, updatedAt,
        quoteRequirement, deliveryRequirement, evaluationMethod, null);
  }
}
