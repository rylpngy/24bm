package com.procurement.sourcing.domain;

import java.util.Set;

// 采购方式:1.0 版本开放询比、竞价、商城、单一来源;旧招标类方式统一兼容映射。
public final class RfqMethod {
  public static final String COMPARE = "询比";
  public static final String AUCTION = "竞价";
  public static final String MALL = "商城";
  public static final String SINGLE_SOURCE = "单一来源";

  private static final Set<String> ALL =
      Set.of(COMPARE, AUCTION, MALL, SINGLE_SOURCE);

  private static final Set<String> LEGACY_COMPARE =
      Set.of("询价", "公开招标", "邀请招标", "竞争性谈判");

  private RfqMethod() {}

  public static String orDefault(String method) {
    if (method == null || method.isBlank()) {
      return COMPARE;
    }
    if (LEGACY_COMPARE.contains(method)) {
      return COMPARE;
    }
    return method;
  }

  public static boolean isValid(String method) {
    return ALL.contains(orDefault(method));
  }

  // 1.0 供应商家数下限:询比/竞价至少 3 家;单一来源 1 家;商城不强制邀请供应商。
  public static int minSuppliers(String method) {
    String m = orDefault(method);
    if (MALL.equals(m)) return 0;
    if (SINGLE_SOURCE.equals(m)) return 1;
    return 3;
  }

  // 询比/竞价定标须有不少于 3 家有效报价;单一来源 1 家;商城可由商品/货架路径形成订单。
  public static final int AWARD_MIN_BIDDERS_COMPETITIVE = 3;

  // 定标资格:按采购方式校验「能否定标」。
  public static void requireAwardEligible(String method, int currentRound, int bidderCount, String rfqId) {
    String m = orDefault(method);
    if (MALL.equals(m)) {
      return;
    }
    if (SINGLE_SOURCE.equals(m)) {
      if (bidderCount < 1) {
        throw new IllegalStateException("单一来源须有 1 家报价方可定标: " + rfqId);
      }
      return;
    }
    if (bidderCount < AWARD_MIN_BIDDERS_COMPETITIVE) {
      throw new IllegalStateException(
          m + "定标须有不少于" + AWARD_MIN_BIDDERS_COMPETITIVE + "家有效报价(当前"
              + bidderCount + "家),否则应予流标: " + rfqId);
    }
  }

  // 单一来源须保留来源说明(审批留痕);其他方式不接受该字段,保持数据口径干净。
  public static void requireSourceJustification(String method, String reason) {
    String m = orDefault(method);
    boolean blank = reason == null || reason.isBlank();
    if (SINGLE_SOURCE.equals(m)) {
      if (blank) {
        throw new IllegalArgumentException("单一来源采购必须填写来源说明(选择该供应商的依据)");
      }
      return;
    }
    if (!blank) {
      throw new IllegalArgumentException("仅单一来源方式可填写来源说明");
    }
  }

  // 询比/竞价指定供应商时不少于 3 家;单一来源有且仅有 1 家;商城不强制邀请供应商。
  public static void requireSupplierCount(String method, int count) {
    String m = orDefault(method);
    if (!isValid(m)) {
      throw new IllegalArgumentException("Unknown procurement method: " + method);
    }
    if (MALL.equals(m)) {
      return;
    }
    if (SINGLE_SOURCE.equals(m)) {
      if (count != 1) {
        throw new IllegalStateException("单一来源须且仅须邀请 1 家供应商(当前" + count + "家)");
      }
      return;
    }
    if (count == 0) {
      return;
    }
    int min = minSuppliers(m);
    if (count < min) {
      throw new IllegalStateException(
          m + "须邀请不少于" + min + "家供应商(当前" + count + "家)");
    }
  }
}
