package com.procurement.supplier.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record QualificationReviewRequest(@NotNull Boolean approved, @NotBlank @Size(max=2000) String comment) {}
