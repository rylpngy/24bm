package com.procurement.tender.api;

import jakarta.validation.constraints.NotBlank;

public record ApplyPrequalificationRequest(@NotBlank String application) {
}
