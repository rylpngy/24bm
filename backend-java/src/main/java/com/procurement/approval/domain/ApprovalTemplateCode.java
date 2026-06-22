package com.procurement.approval.domain;

public final class ApprovalTemplateCode {
  public static final String PURCHASE_DEMAND = "TPL_PURCHASE_DEMAND";
  public static final String SUPPLIER_ADMISSION = "TPL_SUPPLIER_ADMISSION";
  public static final String RFQ_AWARD = "TPL_RFQ_AWARD";
  public static final String PAYMENT_REQUEST = "TPL_PAYMENT_REQUEST";
  public static final String PAYMENT_BATCH = "TPL_PAYMENT_BATCH";
  public static final String PAYMENT_ARCHIVE_EXCEPTION = "TPL_PAYMENT_ARCHIVE_EXCEPTION";
  public static final String CONTRACT_APPROVAL = "TPL_CONTRACT_APPROVAL";

  private ApprovalTemplateCode() {}

  public static String requireByBusinessType(String businessType) {
    return switch (businessType) {
      case ApprovalBusinessType.PURCHASE_DEMAND -> PURCHASE_DEMAND;
      case ApprovalBusinessType.BUYER_SUPPLIER_ADMISSION -> SUPPLIER_ADMISSION;
      case ApprovalBusinessType.RFQ_AWARD -> RFQ_AWARD;
      case ApprovalBusinessType.PAYMENT_REQUEST -> PAYMENT_REQUEST;
      case ApprovalBusinessType.PAYMENT_BATCH -> PAYMENT_BATCH;
      case ApprovalBusinessType.PAYMENT_ARCHIVE_EXCEPTION -> PAYMENT_ARCHIVE_EXCEPTION;
      case ApprovalBusinessType.CONTRACT_APPROVAL -> CONTRACT_APPROVAL;
      default -> throw new IllegalArgumentException("Unsupported approval biz type: " + businessType);
    };
  }
}
