package com.procurement.sourcing.api;

import jakarta.validation.constraints.NotBlank;

public record AwardRfqRequest(
    @NotBlank String quoteId,
    @NotBlank String reason) {
}
