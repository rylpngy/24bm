package com.procurement.tender.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record FailTenderRequest(@NotBlank @Size(max = 1000) String reason) {
}
