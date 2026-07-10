package com.procurement.sourcing.api;

// 开标请求:force=true 表示未到截止时间也强制开标(需采购方显式确认)。
public record OpenRfqRequest(boolean force) {
}
