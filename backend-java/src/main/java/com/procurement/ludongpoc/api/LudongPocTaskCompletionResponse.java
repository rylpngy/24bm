package com.procurement.ludongpoc.api;

import java.time.OffsetDateTime;

public record LudongPocTaskCompletionResponse(String status, OffsetDateTime actedAt) {
}
