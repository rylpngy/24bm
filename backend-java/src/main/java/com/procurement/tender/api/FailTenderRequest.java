package com.procurement.tender.api;

import jakarta.validation.constraints.NotBlank;

public record FailTenderRequest(@NotBlank String reason) {
}
