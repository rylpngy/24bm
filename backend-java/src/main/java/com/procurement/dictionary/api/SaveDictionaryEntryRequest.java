package com.procurement.dictionary.api;

import jakarta.validation.constraints.NotBlank;

public record SaveDictionaryEntryRequest(
    @NotBlank String type,
    @NotBlank String code,
    @NotBlank String label,
    Integer sortOrder,
    String status) {
}
