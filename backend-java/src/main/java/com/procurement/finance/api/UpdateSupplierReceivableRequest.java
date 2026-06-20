package com.procurement.finance.api;

import jakarta.validation.constraints.NotBlank;

public record UpdateSupplierReceivableRequest(
    @NotBlank String reconciliationNote) {
}
