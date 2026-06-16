package com.procurement.approval.domain;

public final class ApprovalTemplateCode {
  public static final String PURCHASE_DEMAND = "TPL_PURCHASE_DEMAND";
  public static final String SUPPLIER_ADMISSION = "TPL_SUPPLIER_ADMISSION";
  public static final String RFQ_AWARD = "TPL_RFQ_AWARD";

  private ApprovalTemplateCode() {}

  public static String requireByBusinessType(String businessType) {
    return switch (businessType) {
      case ApprovalBusinessType.PURCHASE_DEMAND -> PURCHASE_DEMAND;
      case ApprovalBusinessType.BUYER_SUPPLIER_ADMISSION -> SUPPLIER_ADMISSION;
      case ApprovalBusinessType.RFQ_AWARD -> RFQ_AWARD;
      default -> throw new IllegalArgumentException("Unsupported approval biz type: " + businessType);
    };
  }
}
