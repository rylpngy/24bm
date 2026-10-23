package com.procurement.supplier.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.Map;

public record SubmitSupplierExitRequest(
    @NotBlank @Size(max = 2000) String reason,
    Map<String, Object> formData) {}
