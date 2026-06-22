package com.procurement.contract.api;

import jakarta.validation.constraints.NotBlank;

public record UpdateContractArchiveStatusRequest(
    @NotBlank String archiveStatus) {
}
