package com.procurement.supplier.domain;

import java.util.Set;

/** 供应商生命周期标记（绩效驱动，与准入状态、能力等级正交）。 */
public final class SupplierCooperationTier {
  public static final String PREFERRED = "优选";
  public static final String QUALIFIED = "合格";
  public static final String WATCH = "观察";
  public static final String ELIMINATED = "淘汰";

  private static final Set<String> VALID = Set.of(PREFERRED, QUALIFIED, WATCH, ELIMINATED);

  private SupplierCooperationTier() {}

  public static void requireValid(String tier) {
    if (tier == null || !VALID.contains(tier)) {
      throw new IllegalArgumentException("非法生命周期标记: " + tier);
    }
  }
}
