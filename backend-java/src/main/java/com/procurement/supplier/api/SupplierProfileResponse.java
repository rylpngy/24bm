package com.procurement.supplier.api;

import java.util.List;

public record SupplierProfileResponse(
    String id,
    String name,
    String type,
    String industry,
    Boolean verified,
    String creditCode,
    String legalPerson,
    String verifiedStatus,
    String profileStatus,
    List<String> connectedBuyerNames) {
}
