package com.procurement.demand.api;

import java.util.Map;

// 动态审批表单值；需求自身的基础字段仍由采购需求草稿维护。
public record SubmitPurchaseDemandRequest(Map<String, Object> formData) {
  public SubmitPurchaseDemandRequest() {
    this(Map.of());
  }
}
