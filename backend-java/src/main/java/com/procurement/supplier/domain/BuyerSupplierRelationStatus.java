package com.procurement.supplier.domain;

public final class BuyerSupplierRelationStatus {
  public static final String PENDING_ADMISSION = "待准入";
  public static final String IN_ADMISSION_APPROVAL = "准入审批中";
  public static final String ADMITTED = "已准入";
  public static final String REJECTED = "已驳回";
  public static final String BLACKLISTED = "黑名单";

  private BuyerSupplierRelationStatus() {
  }
}
