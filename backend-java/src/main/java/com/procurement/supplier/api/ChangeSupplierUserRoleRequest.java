package com.procurement.supplier.api;

import jakarta.validation.constraints.NotBlank;

public record ChangeSupplierUserRoleRequest(@NotBlank String roleId) {}
