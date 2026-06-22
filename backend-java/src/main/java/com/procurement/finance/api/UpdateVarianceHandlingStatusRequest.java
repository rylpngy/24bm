package com.procurement.finance.api;

import jakarta.validation.constraints.NotBlank;

public record UpdateVarianceHandlingStatusRequest(
    @NotBlank String status,
    String result) {
}
