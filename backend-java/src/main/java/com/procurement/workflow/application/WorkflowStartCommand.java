package com.procurement.workflow.application;

import java.math.BigDecimal;
import java.util.Map;

// 业务服务发起审批时传入的统一命令。业务对象先进入“审批中”，引擎成功启动后才对外返回。
public record WorkflowStartCommand(
    String businessType,
    String businessId,
    String departmentId,
    BigDecimal amount,
    Map<String, Object> formData,
    Map<String, Object> businessSnapshot) {
}
