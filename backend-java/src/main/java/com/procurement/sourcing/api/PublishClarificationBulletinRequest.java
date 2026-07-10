package com.procurement.sourcing.api;

import jakarta.validation.constraints.NotBlank;

public record PublishClarificationBulletinRequest(@NotBlank String content) {
}
