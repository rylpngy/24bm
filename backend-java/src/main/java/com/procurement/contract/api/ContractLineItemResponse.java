package com.procurement.contract.api;

import java.math.BigDecimal;

// 合同行项(派生自关联订单行项)。
public record ContractLineItemResponse(
    String orderLineId,
    String description,
    String unit,
    BigDecimal quantity,
    BigDecimal unitPrice,
    BigDecimal lineAmount) {
}
