package com.procurement.order.domain;

import java.util.Set;

// 收货验收质检:按收货量/合格量判定验收结论;不合格须选择处置方式。
public final class ReceiptInspection {
  public static final String ALL_QUALIFIED = "全部合格";
  public static final String PARTIAL = "部分合格";
  public static final String ALL_REJECTED = "全部不合格";

  // 不合格处置:退货换货 / 让步接收(降价收下)。
  public static final String RETURN_REPLACE = "退货换货";
  public static final String CONCESSION = "让步接收";
  private static final Set<String> DISPOSITIONS = Set.of(RETURN_REPLACE, CONCESSION);

  private ReceiptInspection() {}

  // 按收货数量与合格数量判定结论。
  public static String conclude(int received, int qualified) {
    if (received <= 0 || qualified >= received) {
      return ALL_QUALIFIED;
    }
    return qualified <= 0 ? ALL_REJECTED : PARTIAL;
  }

  // 非「全部合格」须给出有效处置;全部合格则不应填处置。
  public static void requireDisposition(String conclusion, String disposition) {
    if (ALL_QUALIFIED.equals(conclusion)) {
      return;
    }
    if (disposition == null || !DISPOSITIONS.contains(disposition)) {
      throw new IllegalStateException(
          "存在不合格(" + conclusion + "),须选择处置方式:退货换货 / 让步接收");
    }
  }
}
