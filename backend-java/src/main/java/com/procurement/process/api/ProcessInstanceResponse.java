package com.procurement.process.api;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

// 流程实例:resolvedPath 为解析出的审批路径快照(JSON 文本);currentIndex 指向当前待审批节点(在审批节点序列中)。
public record ProcessInstanceResponse(
    String id,
    String processId,
    String processName,
    BigDecimal amount,
    String status,
    int currentIndex,
    String resolvedPath,
    String formData,
    String initiatorId,
    OffsetDateTime createdAt) {
}
