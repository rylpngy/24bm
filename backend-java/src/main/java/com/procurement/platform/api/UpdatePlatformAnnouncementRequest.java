package com.procurement.platform.api;

import jakarta.validation.constraints.NotBlank;

public record UpdatePlatformAnnouncementRequest(
    @NotBlank String title,
    @NotBlank String content,
    @NotBlank String audience) {
}
