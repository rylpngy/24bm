package com.procurement.order.application;

import com.procurement.order.api.OrderLineItemResponse;
import com.procurement.order.domain.OrderLineItem;
import com.procurement.order.infrastructure.OrderLineItemMapper;
import com.procurement.sourcing.domain.QuoteLineItem;
import com.procurement.sourcing.infrastructure.QuoteLineItemMapper;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;

// 订单行项明细:生成订单时从中标报价行项复制(同一租户),并为订单响应提供明细列表。
@Service
public class OrderLineItemApplicationService {
  private final OrderLineItemMapper orderLineItemMapper;
  private final QuoteLineItemMapper quoteLineItemMapper;

  public OrderLineItemApplicationService(
      OrderLineItemMapper orderLineItemMapper, QuoteLineItemMapper quoteLineItemMapper) {
    this.orderLineItemMapper = orderLineItemMapper;
    this.quoteLineItemMapper = quoteLineItemMapper;
  }

  // 将中标报价的行项原样复制为订单行项(保留品名/单位/数量/单价/行金额与排序)。
  public void copyFromQuote(String tenantId, String orderId, String quoteId) {
    if (quoteId == null) {
      return;
    }
    List<QuoteLineItem> quoteLines = quoteLineItemMapper.listByQuote(tenantId, quoteId);
    if (quoteLines == null) {
      return;
    }
    for (QuoteLineItem line : quoteLines) {
      orderLineItemMapper.insert(
          "oli-" + UUID.randomUUID(),
          tenantId,
          orderId,
          line.description(),
          line.unit(),
          line.quantity(),
          line.unitPrice(),
          line.lineAmount(),
          line.sortNo() == null ? 0 : line.sortNo());
    }
  }

  // 商城直购单行明细:协议价 × 数量,无报价来源。
  public void addDirectLine(
      String tenantId,
      String orderId,
      String description,
      String unit,
      java.math.BigDecimal quantity,
      java.math.BigDecimal unitPrice) {
    orderLineItemMapper.insert(
        "oli-" + UUID.randomUUID(),
        tenantId,
        orderId,
        description,
        unit,
        quantity,
        unitPrice,
        quantity.multiply(unitPrice),
        1);
  }

  public List<OrderLineItemResponse> listForOrder(String tenantId, String orderId) {
    List<OrderLineItem> lines = orderLineItemMapper.listByOrder(tenantId, orderId);
    if (lines == null) {
      return List.of();
    }
    return lines.stream()
        .map(
            l ->
                new OrderLineItemResponse(
                    l.id(), l.description(), l.unit(), l.quantity(), l.unitPrice(), l.lineAmount()))
        .toList();
  }
}
