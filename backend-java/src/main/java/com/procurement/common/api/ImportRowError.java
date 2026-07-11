package com.procurement.common.api;

// Excel 导入失败行:rowNumber 为工作表中的行号(表头为第 1 行)。
public record ImportRowError(int rowNumber, String message) {
}
