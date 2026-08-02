package com.procurement.dictionary.domain;

/** 字典类型汇总:条目总数与启用数(平台运营配置台账)。 */
public record DictionaryTypeSummary(String type, long entryCount, long activeCount) {
}
