package com.procurement.ludongpoc.api;

import jakarta.validation.constraints.NotBlank;
import java.util.Map;

public record LudongPocAiReviewRequest(
    @NotBlank String nodeId,
    Map<String, Object> currentReviewData) {
}
