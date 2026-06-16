package com.procurement.demand.domain;

public final class PurchaseDemandStatus {
  public static final String DRAFT = "草稿";
  public static final String IN_APPROVAL = "审批中";
  public static final String APPROVED = "已通过";
  public static final String REJECTED = "已驳回";

  private PurchaseDemandStatus() {
  }
}
