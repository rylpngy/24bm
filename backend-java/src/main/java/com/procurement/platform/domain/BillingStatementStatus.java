package com.procurement.platform.domain;

// 账单状态机:草稿 →(开票)→ 已开票 →(收款)→ 已结清。
public final class BillingStatementStatus {
  public static final String DRAFT = "草稿";
  public static final String ISSUED = "已开票";
  public static final String PAID = "已结清";

  private BillingStatementStatus() {}
}
