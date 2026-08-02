package com.procurement.dictionary.api;

/** 平台维护视图:含状态,便于运营看到停用条目。 */
public record DictionaryAdminEntryResponse(
    String type,
    String code,
    String label,
    int sortOrder,
    String status) {
}
