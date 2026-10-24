package com.procurement.order.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.util.List;

// Missing lines are mapped only for a full, unambiguous receipt of known order balances.
public record CreateReceiptRequest(
    @NotBlank String result,
    Integer receivedQuantity,
    Integer qualifiedQuantity,
    String qualityNote,
    @Valid List<ReceiptLineItemRequest> lineItems,
    String disposition,
    String dispositionNote) {
}
