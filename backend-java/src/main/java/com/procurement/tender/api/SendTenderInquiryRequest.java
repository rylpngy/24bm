package com.procurement.tender.api;

import jakarta.validation.constraints.NotBlank;

public record SendTenderInquiryRequest(
    @NotBlank String bidId, @NotBlank String kind, @NotBlank String question) {
}
