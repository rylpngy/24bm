package com.procurement.sourcing.api;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import java.time.OffsetDateTime;
import java.util.List;

public record UpdateRfqRequest(
    @NotBlank String title,
    List<String> invitedSupplierIds,
    @Future OffsetDateTime deadlineAt,
    String quoteRequirement,
    String deliveryRequirement,
    String evaluationMethod) {
}
