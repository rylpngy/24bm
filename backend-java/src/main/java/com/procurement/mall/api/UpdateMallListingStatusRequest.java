package com.procurement.mall.api;

import jakarta.validation.constraints.NotBlank;

public record UpdateMallListingStatusRequest(@NotBlank String status) {
}
