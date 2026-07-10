package com.procurement.order.domain;

import java.time.OffsetDateTime;

public record Receipt(
    String id,
    String tenantId,
    String orderId,
    String receiverId,
    String result,
    OffsetDateTime receivedAt,
    Integer receivedQuantity,
    Integer qualifiedQuantity,
    String qualityNote,
    String inspectionConclusion,
    String disposition,
    String dispositionNote) {
}
