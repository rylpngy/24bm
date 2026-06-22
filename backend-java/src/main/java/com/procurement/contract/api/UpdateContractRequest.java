package com.procurement.contract.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import java.math.BigDecimal;
import java.time.LocalDate;

public record UpdateContractRequest(
    @NotBlank String contractNo,
    @NotBlank String contractName,
    @NotNull @PositiveOrZero BigDecimal amount,
    @NotBlank String status,
    @NotBlank String fulfillmentProgress,
    LocalDate effectiveDate) {
}
