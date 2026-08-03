package com.procurement.mall.domain;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/** 售后单(M-4):挂在采购订单行上——订单行是履约与对账的最小单元。 */
public record MallAfterSales(
    String id,
    String tenantId,
    String orderId,
    String orderLineId,
    String supplierId,
    String supplierName,
    String type,
    BigDecimal quantity,
    String reason,
    String status,
    String supplierReply,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {
}
