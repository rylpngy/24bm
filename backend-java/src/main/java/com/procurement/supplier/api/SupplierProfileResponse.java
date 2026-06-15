package com.procurement.supplier.api;

import java.util.List;

public record SupplierProfileResponse(
    String id,
    String name,
    String type,
    String industry,
    Boolean verified,
    List<String> connectedBuyerNames) {
}
