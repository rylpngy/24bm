package com.procurement.contract.api;

import jakarta.validation.constraints.NotBlank;

public record UpdateContractStatusRequest(
    @NotBlank String status,
    @NotBlank String fulfillmentProgress) {
}
