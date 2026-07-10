package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.order.application.OrderLineItemApplicationService;
import com.procurement.order.domain.OrderLineItem;
import com.procurement.order.infrastructure.OrderLineItemMapper;
import com.procurement.sourcing.domain.QuoteLineItem;
import com.procurement.sourcing.infrastructure.QuoteLineItemMapper;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

// 「报价→订单」行项复制:订单生成时把中标报价行项原样落为订单行项。
class OrderLineItemCopyTests {

  private final OrderLineItemMapper orderLineItemMapper = mock(OrderLineItemMapper.class);
  private final QuoteLineItemMapper quoteLineItemMapper = mock(QuoteLineItemMapper.class);
  private final OrderLineItemApplicationService service =
      new OrderLineItemApplicationService(orderLineItemMapper, quoteLineItemMapper);

  @Test
  void copyFromQuoteMirrorsEachQuoteLineIntoOrderLine() {
    when(quoteLineItemMapper.listByQuote("tenant-1", "quote-1"))
        .thenReturn(List.of(
            new QuoteLineItem("qli-a", "tenant-1", "quote-1", "服务器", "台",
                BigDecimal.valueOf(10), BigDecimal.valueOf(9800), BigDecimal.valueOf(98000), 0),
            new QuoteLineItem("qli-b", "tenant-1", "quote-1", "交换机", "台",
                BigDecimal.valueOf(8), BigDecimal.valueOf(2500), BigDecimal.valueOf(20000), 1)));

    service.copyFromQuote("tenant-1", "po-1", "quote-1");

    verify(orderLineItemMapper).insert(anyString(), eq("tenant-1"), eq("po-1"), eq("服务器"),
        eq("台"), eq(BigDecimal.valueOf(10)), eq(BigDecimal.valueOf(9800)), eq(BigDecimal.valueOf(98000)), eq(0));
    verify(orderLineItemMapper).insert(anyString(), eq("tenant-1"), eq("po-1"), eq("交换机"),
        eq("台"), eq(BigDecimal.valueOf(8)), eq(BigDecimal.valueOf(2500)), eq(BigDecimal.valueOf(20000)), eq(1));
  }

  @Test
  void copyFromQuoteWithNullQuoteIdIsNoOp() {
    service.copyFromQuote("tenant-1", "po-1", null);
    verify(orderLineItemMapper, never())
        .insert(anyString(), anyString(), anyString(), anyString(), anyString(),
            org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(), anyInt());
  }

  @Test
  void listForOrderMapsLineFields() {
    when(orderLineItemMapper.listByOrder("tenant-1", "po-1"))
        .thenReturn(List.of(new OrderLineItem("oli-a", "tenant-1", "po-1", "打印机", "台",
            BigDecimal.valueOf(4), BigDecimal.valueOf(8000), BigDecimal.valueOf(32000), 0)));

    var lines = service.listForOrder("tenant-1", "po-1");

    assertThat(lines).hasSize(1);
    assertThat(lines.get(0).description()).isEqualTo("打印机");
    assertThat(lines.get(0).lineAmount()).isEqualByComparingTo("32000");
  }
}
