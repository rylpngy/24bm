package com.procurement.mall.api;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record UpdateMallListingPriceRequest(@NotNull BigDecimal price) {
}
