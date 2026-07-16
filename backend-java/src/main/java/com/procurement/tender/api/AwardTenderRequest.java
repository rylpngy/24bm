package com.procurement.tender.api;

import jakarta.validation.constraints.NotBlank;

public record AwardTenderRequest(@NotBlank String bidId, @NotBlank String awardNoticeHtml) {
}
