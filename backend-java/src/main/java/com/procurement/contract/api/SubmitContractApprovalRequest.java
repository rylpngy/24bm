package com.procurement.contract.api;

import java.util.Map;

/** 合同审批发起时填写的已发布流程表单数据。 */
public record SubmitContractApprovalRequest(Map<String, Object> formData) {
}
