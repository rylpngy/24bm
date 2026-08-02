package com.procurement.supplier.api;

import jakarta.validation.constraints.NotBlank;

public record CreateQualificationUploadTicketRequest(@NotBlank String fileName) {
}
