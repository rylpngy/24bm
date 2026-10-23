package com.procurement.buyer.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import java.math.BigDecimal;

public record UpsertDepartmentBudgetRequest(
    @NotBlank String departmentId,
    @NotBlank @jakarta.validation.constraints.Pattern(regexp = "[0-9]{4}") String period,
    @NotNull @PositiveOrZero BigDecimal totalAmount) {
}
