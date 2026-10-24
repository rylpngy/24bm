package com.procurement.order.domain;

import java.math.BigDecimal;

public record OrderFulfillmentLine(
    String orderLineId, BigDecimal orderedQuantity, BigDecimal shippedQuantity,
    BigDecimal receivedQuantity, BigDecimal qualifiedQuantity) {}
