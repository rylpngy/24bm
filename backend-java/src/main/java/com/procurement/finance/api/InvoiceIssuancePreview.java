package com.procurement.finance.api;

import java.math.BigDecimal;
import java.util.List;

public record InvoiceIssuancePreview(
    String orderId,
    BigDecimal orderAmount,
    BigDecimal invoicedAmount,
    BigDecimal remainingAmount,
    List<Line> lines,
    List<String> blockers) {
  @io.swagger.v3.oas.annotations.media.Schema(name = "InvoiceIssuanceBalance")
  public record Line(
      String orderLineId,
      String description,
      String unit,
      BigDecimal orderedQuantity,
      BigDecimal unitPrice,
      BigDecimal invoicedQuantity,
      BigDecimal remainingQuantity) {}
}
