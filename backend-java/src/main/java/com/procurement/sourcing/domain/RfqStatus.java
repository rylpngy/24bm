package com.procurement.sourcing.domain;

public final class RfqStatus {
  public static final String QUOTING = "报价中";
  public static final String OPENED = "已开标";
  public static final String AWARD_APPROVAL = "定标审批中";
  public static final String AWARDED = "已定标";
  public static final String NO_BID = "已流标";
  public static final String ABORTED = "已废标";

  private RfqStatus() {
  }
}
