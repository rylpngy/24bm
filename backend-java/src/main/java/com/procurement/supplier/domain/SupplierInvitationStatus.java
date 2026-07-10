package com.procurement.supplier.domain;

import java.util.Map;
import java.util.Set;

// 邀请单状态机:待回复 → 已接受 / 已拒绝 / 已撤回(终态不可再转)。
public final class SupplierInvitationStatus {
  public static final String PENDING = "待回复";
  public static final String ACCEPTED = "已接受";
  public static final String DECLINED = "已拒绝";
  public static final String WITHDRAWN = "已撤回";

  private static final Map<String, String> ACTION_TO_STATUS = Map.of(
      "accept", ACCEPTED,
      "decline", DECLINED,
      "withdraw", WITHDRAWN);

  private SupplierInvitationStatus() {}

  public static String resolveTarget(String action) {
    String target = ACTION_TO_STATUS.get(action);
    if (target == null) {
      throw new IllegalArgumentException("不支持的邀请动作: " + action);
    }
    return target;
  }

  public static void requirePending(String currentStatus) {
    if (!PENDING.equals(currentStatus)) {
      throw new IllegalStateException("仅「待回复」邀请可处理,当前为「" + currentStatus + "」");
    }
  }

  public static boolean bridgesToAdmission(String target) {
    return ACCEPTED.equals(target);
  }

  public static Set<String> all() {
    return Set.of(PENDING, ACCEPTED, DECLINED, WITHDRAWN);
  }
}
