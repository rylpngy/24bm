package com.procurement.supplier.domain;

public record SupplierUser(
    String id,
    String supplierId,
    String name,
    String mobile,
    String email,
    String status,
    String roleId) {
}
