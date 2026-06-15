package com.procurement.supplier.domain;

public record SupplierProfile(
    String id,
    String name,
    String type,
    String industry,
    Boolean verified,
    String creditCode,
    String legalPerson,
    String verifiedStatus,
    String profileStatus) {
}
