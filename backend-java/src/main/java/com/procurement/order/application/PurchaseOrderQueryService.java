package com.procurement.order.application;

import com.procurement.order.domain.OrderLineItem;
import com.procurement.order.domain.PurchaseOrder;
import com.procurement.order.infrastructure.OrderLineItemMapper;
import com.procurement.order.infrastructure.PurchaseOrderMapper;
import java.math.BigDecimal;
import org.springframework.stereotype.Service;

/**
 * 订单只读查询(M-4):给需要「按订单行做业务判断」的上下文一个窄接口。
 *
 * <p>商城的售后与评价要同时知道订单状态、供应商与行数量;直接把 mapper 暴露给 mall
 * 会让边界失守,故在 order 上下文里提供这个只读视图。
 */
@Service
public class PurchaseOrderQueryService {

  private final PurchaseOrderMapper purchaseOrderMapper;
  private final OrderLineItemMapper orderLineItemMapper;

  public PurchaseOrderQueryService(
      PurchaseOrderMapper purchaseOrderMapper, OrderLineItemMapper orderLineItemMapper) {
    this.purchaseOrderMapper = purchaseOrderMapper;
    this.orderLineItemMapper = orderLineItemMapper;
  }

  /** 订单行视图:够做售后/评价前置判断即可,不下发订单全量。 */
  public record OrderLineView(
      String orderId,
      String orderLineId,
      String orderStatus,
      String supplierId,
      String description,
      BigDecimal quantity) {}

  /** 按租户查订单行;订单不属于本租户或行不在该订单下时返回 null。 */
  public OrderLineView findLineForTenant(String tenantId, String orderId, String orderLineId) {
    PurchaseOrder order = purchaseOrderMapper.findByTenantAndId(tenantId, orderId);
    if (order == null) {
      return null;
    }
    return orderLineItemMapper.listByOrder(tenantId, orderId).stream()
        .filter(line -> line.id().equals(orderLineId))
        .findFirst()
        .map(line -> toView(order, line))
        .orElse(null);
  }

  private static OrderLineView toView(PurchaseOrder order, OrderLineItem line) {
    return new OrderLineView(
        order.id(), line.id(), order.status(), order.supplierId(),
        line.description(), line.quantity());
  }
}
