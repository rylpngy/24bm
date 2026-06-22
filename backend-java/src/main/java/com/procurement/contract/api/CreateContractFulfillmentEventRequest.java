package com.procurement.contract.api;

import jakarta.validation.constraints.NotBlank;

public record CreateContractFulfillmentEventRequest(
    @NotBlank String actionType,
    @NotBlank String targetId,
    @NotBlank String summary,
    @NotBlank String sourceLabel) {
}
