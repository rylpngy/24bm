package com.procurement.attachment.api;

import jakarta.validation.constraints.NotBlank;

public record CreateAttachmentRequest(
    @NotBlank String ownerType,
    @NotBlank String ownerId,
    @NotBlank String fileName,
    @NotBlank String storageKey,
    String visibility) {
}
