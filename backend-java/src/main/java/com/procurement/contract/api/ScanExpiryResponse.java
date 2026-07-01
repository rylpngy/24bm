package com.procurement.contract.api;

// 到期合同扫描结果:withinDays 阈值内临近到期的合同数 + 已生成提醒数。
public record ScanExpiryResponse(int withinDays, int scanned, int notified) {
}
