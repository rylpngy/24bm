package com.procurement.process.api;

import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;

// 发起流程实例:processId + 表单数据(JSON 文本)+ 金额(用于审批中心摘要,可空)。
public record StartProcessInstanceRequest(
    @NotBlank String processId,
    @NotBlank String formData,
    BigDecimal amount) {
}
