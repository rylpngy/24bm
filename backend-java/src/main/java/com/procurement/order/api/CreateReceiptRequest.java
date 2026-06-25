package com.procurement.order.api;

import jakarta.validation.constraints.NotBlank;

public record CreateReceiptRequest(
    @NotBlank String result,
    Integer receivedQuantity,
    Integer qualifiedQuantity,
    String qualityNote) {
}
