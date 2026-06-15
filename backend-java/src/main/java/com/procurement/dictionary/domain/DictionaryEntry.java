package com.procurement.dictionary.domain;

public record DictionaryEntry(
    String type,
    String code,
    String label,
    int sortOrder) {
}
