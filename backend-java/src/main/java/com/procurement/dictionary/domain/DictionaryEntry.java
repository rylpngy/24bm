package com.procurement.dictionary.domain;

public record DictionaryEntry(
    String type,
    String code,
    String label,
    int sortOrder,
    // 平台维护视图携带状态(active/inactive);业务只读查询仅取 active。
    String status) {
}
