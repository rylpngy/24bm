package com.procurement.tender.api;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

public record ExecuteTenderRequest(@NotNull LocalDate expectedReceiptDate) {
}
