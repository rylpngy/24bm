package com.procurement.supplier.api;

import jakarta.validation.constraints.NotNull;

public record ReviewBuyerSupplierAdmissionRequest(@NotNull Boolean approved) {
}
