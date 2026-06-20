package com.procurement.platform.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record EnterpriseReviewRequest(
    @NotNull Boolean verified,
    @NotBlank String reviewStatus,
    String reviewComment,
    Boolean profileConfirmed,
    Boolean riskConfirmed) {
}
