package com.procurement.order.api;

import jakarta.validation.constraints.Future;
import java.time.LocalDate;

public record UpdatePurchaseOrderRequest(
    @Future LocalDate expectedReceiptDate) {
}
