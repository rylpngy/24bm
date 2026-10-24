package com.procurement.order.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateReceiptDispositionReviewRequest(
    @NotBlank @Size(max = 30) String decision,
    @NotBlank @Size(max = 2000) String reason,
    @NotBlank @Size(max = 500) String evidenceNo) {}
