package com.procurement.ludongpoc.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public record LudongPocApplicationRequest(
    @NotBlank String projectName,
    @NotBlank String applicantUnit,
    String departmentId,
    @NotNull BigDecimal budgetAmount,
    @NotNull Map<String, Object> formData,
    @NotNull List<Map<String, Object>> items) {
}
