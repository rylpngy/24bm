package com.procurement.sourcing.domain;

import java.util.Set;

// 采购方式:不同方式的法定供应商家数下限不同(单一来源 1 家,其余 ≥3 家)。
public final class RfqMethod {
  public static final String PUBLIC_TENDER = "公开招标";
  public static final String INVITED_TENDER = "邀请招标";
  public static final String NEGOTIATION = "竞争性谈判";
  public static final String INQUIRY = "询价";
  public static final String SINGLE_SOURCE = "单一来源";

  private static final Set<String> ALL =
      Set.of(PUBLIC_TENDER, INVITED_TENDER, NEGOTIATION, INQUIRY, SINGLE_SOURCE);

  private RfqMethod() {}

  public static String orDefault(String method) {
    return method == null || method.isBlank() ? INQUIRY : method;
  }

  public static boolean isValid(String method) {
    return ALL.contains(method);
  }

  // 法定供应商家数下限:单一来源 1 家,其余至少 3 家。
  public static int minSuppliers(String method) {
    return SINGLE_SOURCE.equals(method) ? 1 : 3;
  }

  // 竞争性谈判须经至少一轮谈判(即当前轮 ≥2)。
  public static final int NEGOTIATION_MIN_ROUND = 2;
  // 招标/询价定标须有不少于 3 家有效报价(法定家数);单一来源 1 家即可。
  public static final int AWARD_MIN_BIDDERS_COMPETITIVE = 3;

  // 定标资格:按采购方式校验「能否定标」。
  public static void requireAwardEligible(String method, int currentRound, int bidderCount, String rfqId) {
    String m = orDefault(method);
    if (NEGOTIATION.equals(m)) {
      if (currentRound < NEGOTIATION_MIN_ROUND) {
        throw new IllegalStateException(
            "竞争性谈判须经至少一轮谈判后方可定标(当前第" + currentRound + "轮): " + rfqId);
      }
      return;
    }
    if (SINGLE_SOURCE.equals(m)) {
      if (bidderCount < 1) {
        throw new IllegalStateException("单一来源须有 1 家报价方可定标: " + rfqId);
      }
      return;
    }
    // 公开招标 / 邀请招标 / 询价:不少于法定家数。
    if (bidderCount < AWARD_MIN_BIDDERS_COMPETITIVE) {
      throw new IllegalStateException(
          m + "定标须有不少于" + AWARD_MIN_BIDDERS_COMPETITIVE + "家有效报价(当前"
              + bidderCount + "家),否则应予流标: " + rfqId);
    }
  }

  // 单一来源:有且仅有 1 家;其余:不少于下限。
  public static void requireSupplierCount(String method, int count) {
    String m = orDefault(method);
    if (!isValid(m)) {
      throw new IllegalArgumentException("Unknown procurement method: " + method);
    }
    if (SINGLE_SOURCE.equals(m)) {
      if (count != 1) {
        throw new IllegalStateException("Single-source RFQ must invite exactly one supplier");
      }
      return;
    }
    int min = minSuppliers(m);
    if (count < min) {
      throw new IllegalStateException(
          m + "须邀请不少于" + min + "家供应商(当前" + count + "家)");
    }
  }
}
