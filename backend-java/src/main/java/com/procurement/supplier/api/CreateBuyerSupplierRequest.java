package com.procurement.supplier.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record CreateBuyerSupplierRequest(
    @NotBlank String supplierId,
    @NotBlank String status,
    @NotBlank String level,
    @NotNull List<String> categories) {
}
