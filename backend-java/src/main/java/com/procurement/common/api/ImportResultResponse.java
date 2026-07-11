package com.procurement.common.api;

import java.util.List;

// Excel 导入结果:部分成功语义——合法行入库,非法行逐条报告原因。
public record ImportResultResponse(int totalRows, int successCount, List<ImportRowError> failures) {
}
