package com.procurement.sourcing.domain;

public final class QuoteStatus {
  public static final String SUBMITTED = "已提交";
  public static final String LOCKED = "已锁定";
  public static final String AWARDED = "已中选";
  public static final String NOT_SELECTED = "未中选";

  private QuoteStatus() {
  }
}
