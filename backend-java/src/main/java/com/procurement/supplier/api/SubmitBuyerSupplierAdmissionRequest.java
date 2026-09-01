package com.procurement.supplier.api;

import java.util.Map;

/** 供应商准入发起时填写的已发布流程表单数据。 */
public record SubmitBuyerSupplierAdmissionRequest(Map<String, Object> formData) {
}
