package com.procurement.mall.api;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.List;

public record SaveMallPurchaseControlRequest(
    @Positive @Digits(integer=12,fraction=2) BigDecimal maxCheckoutAmount,
    @Size(max=100) List<@NotBlank String> categoryIds,
    boolean requireAddress,
    @NotBlank @Size(max=1000) String reason) {}
