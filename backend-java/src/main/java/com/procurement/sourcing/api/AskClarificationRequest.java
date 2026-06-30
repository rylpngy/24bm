package com.procurement.sourcing.api;

import jakarta.validation.constraints.NotBlank;

public record AskClarificationRequest(@NotBlank String question) {
}
