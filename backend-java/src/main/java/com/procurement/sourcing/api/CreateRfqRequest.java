package com.procurement.sourcing.api;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.time.OffsetDateTime;
import java.util.List;

public record CreateRfqRequest(
    @NotBlank String title,
    @NotEmpty List<String> demandIds,
    @NotEmpty List<String> invitedSupplierIds,
    @Future OffsetDateTime deadlineAt,
    String quoteRequirement,
    String deliveryRequirement,
    String evaluationMethod,
    String method) {
}
