package com.procurement.supplier.api;

import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;

public record ConfirmCooperationTierRequest(
    @NotBlank String cooperationTier,
    BigDecimal evaluationScore) {
}
