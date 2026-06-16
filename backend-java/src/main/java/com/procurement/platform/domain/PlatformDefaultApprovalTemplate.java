package com.procurement.platform.domain;

import com.procurement.approval.domain.ApprovalBusinessType;
import java.util.List;

public record PlatformDefaultApprovalTemplate(
    String code,
    String businessType,
    String name,
    int sortOrder) {
  public static final List<PlatformDefaultApprovalTemplate> BUYER_TEMPLATES = List.of(
      new PlatformDefaultApprovalTemplate(
          "TPL_PURCHASE_DEMAND",
          ApprovalBusinessType.PURCHASE_DEMAND,
          "需求审批",
          10),
      new PlatformDefaultApprovalTemplate(
          "TPL_SUPPLIER_ADMISSION",
          ApprovalBusinessType.BUYER_SUPPLIER_ADMISSION,
          "供应商准入",
          20),
      new PlatformDefaultApprovalTemplate(
          "TPL_RFQ_AWARD",
          ApprovalBusinessType.RFQ_AWARD,
          "定标审批",
          30));
}
