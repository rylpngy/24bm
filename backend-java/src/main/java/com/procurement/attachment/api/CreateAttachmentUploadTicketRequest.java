package com.procurement.attachment.api;

import jakarta.validation.constraints.NotBlank;

public record CreateAttachmentUploadTicketRequest(
    @NotBlank String ownerType,
    @NotBlank String ownerId,
    @NotBlank String fileName,
    String visibility) {
}
