package com.procurement.identity.api;

import jakarta.validation.constraints.NotBlank;

public record ChangeBuyerUserStatusRequest(@NotBlank String status) {
}
