package com.procurement.identity.api;

import jakarta.validation.constraints.NotBlank;

public record ResetBuyerUserPasswordRequest(@NotBlank String newPassword) {
}
