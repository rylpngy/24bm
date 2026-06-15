package com.procurement.demand.api;

import jakarta.validation.constraints.NotNull;

public record ReviewPurchaseDemandRequest(@NotNull Boolean approved) {
}
