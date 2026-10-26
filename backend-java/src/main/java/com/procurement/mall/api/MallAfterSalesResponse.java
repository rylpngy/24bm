package com.procurement.mall.api;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/** 售后单(M-4)。 */
public record MallAfterSalesResponse(
    String id,
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
    OffsetDateTime updatedAt,
    String financialStatus) {
  public MallAfterSalesResponse(String id, String orderId, String orderLineId, String supplierId,
      String supplierName, String type, BigDecimal quantity, String reason, String status,
      String supplierReply, OffsetDateTime createdAt, OffsetDateTime updatedAt) {
    this(id, orderId, orderLineId, supplierId, supplierName, type, quantity, reason, status,
        supplierReply, createdAt, updatedAt,
        "已拒绝".equals(status) || "已撤回".equals(status) ? "无售后阻塞"
            : "已完成".equals(status) ? ("退货".equals(type) ? "退货财务待核对" : "无售后阻塞")
            : "售后未决，暂停付款及归档");
  }

  public static MallAfterSalesResponse from(com.procurement.mall.domain.MallAfterSales a) {
    return new MallAfterSalesResponse(a.id(), a.orderId(), a.orderLineId(), a.supplierId(),
        a.supplierName(), a.type(), a.quantity(), a.reason(), a.status(), a.supplierReply(),
        a.createdAt(), a.updatedAt(), a.financialStatus() == null ? new MallAfterSalesResponse(a.id(),a.orderId(),a.orderLineId(),a.supplierId(),a.supplierName(),a.type(),a.quantity(),a.reason(),a.status(),a.supplierReply(),a.createdAt(),a.updatedAt()).financialStatus() : a.financialStatus());
  }
}
