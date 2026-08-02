package com.procurement.tender.api;

import jakarta.validation.constraints.NotBlank;

public record ReviewPrequalificationRequest(@NotBlank String status, @NotBlank String reviewComment) {
}
