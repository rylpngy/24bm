package com.procurement.ludongpoc.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.Map;

public record CompleteLudongPocTaskRequest(
    @NotBlank String applicationId,
    @NotBlank String nodeId,
    @NotBlank String action,
    String comment,
    @NotNull Map<String, Object> reviewData) {
}
