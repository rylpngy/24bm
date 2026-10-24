package com.procurement.mall.api;

import jakarta.validation.constraints.NotBlank;

public record BuyerAfterSalesActionRequest(@NotBlank String note) {}
