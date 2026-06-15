package com.procurement.supplier.domain;

public record SupplierProfile(
    String id,
    String name,
    String type,
    String industry,
    Boolean verified) {
}
