package com.procurement.ludongpoc.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record LudongPocAiReviewFeedbackRequest(
    @NotBlank String findingId,
    @Pattern(regexp = "adopted|false_positive|noted") String disposition,
    String comment) {
}
