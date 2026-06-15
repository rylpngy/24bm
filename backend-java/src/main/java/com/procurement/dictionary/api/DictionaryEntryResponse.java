package com.procurement.dictionary.api;

public record DictionaryEntryResponse(
    String type,
    String code,
    String label,
    int sortOrder) {
}
