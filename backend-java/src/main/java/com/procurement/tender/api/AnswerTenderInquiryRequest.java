package com.procurement.tender.api;

import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;

public record AnswerTenderInquiryRequest(@NotBlank String answer, BigDecimal revisedAmount) {
}
