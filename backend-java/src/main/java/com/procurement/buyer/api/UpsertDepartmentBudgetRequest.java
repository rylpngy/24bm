package com.procurement.buyer.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import java.math.BigDecimal;

public record UpsertDepartmentBudgetRequest(
    @NotBlank String departmentId,
    @NotBlank String period,
    @NotNull @PositiveOrZero BigDecimal totalAmount) {
}
