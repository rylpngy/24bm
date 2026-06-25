package com.procurement.order.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.List;

// lineItems 可选:逐行验收明细;为空时退化为抬头级收货数量/合格数量(兼容旧收货)。
public record CreateReceiptRequest(
    @NotBlank String result,
    Integer receivedQuantity,
    Integer qualifiedQuantity,
    String qualityNote,
    @Valid List<ReceiptLineItemRequest> lineItems) {
}
