package com.procurement.platform.api;

import jakarta.validation.constraints.NotBlank;

public record CreatePlatformAnnouncementRequest(
    @NotBlank String title,
    @NotBlank String content,
    @NotBlank String audience) {
}
