package com.procurement.supplier.api;

public record SupplierUserResponse(
    String id,
    String supplierId,
    String name,
    String mobile,
    String email,
    String status,
    String roleId) {
}
