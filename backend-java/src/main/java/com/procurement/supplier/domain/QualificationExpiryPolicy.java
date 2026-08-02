package com.procurement.supplier.domain;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/**
 * 资质有效期提醒规则(E-1):
 * - 已过期:到期日早于今天;
 * - 临期:到期日在今天起 30 天内(含今日与第 30 天);
 * - 长期有效:未填到期日(视为无固定期限,不提醒)。
 */
public final class QualificationExpiryPolicy {

  public static final int WARNING_DAYS = 30;

  public static final String STATE_NO_EXPIRY = "长期有效";
  public static final String STATE_EXPIRED = "已过期";
  public static final String STATE_EXPIRING = "临期";
  public static final String STATE_VALID = "有效";

  private QualificationExpiryPolicy() {}

  public static String expiryState(LocalDate expiresAt, LocalDate today) {
    if (expiresAt == null) return STATE_NO_EXPIRY;
    if (expiresAt.isBefore(today)) return STATE_EXPIRED;
    if (!expiresAt.isAfter(today.plusDays(WARNING_DAYS))) return STATE_EXPIRING;
    return STATE_VALID;
  }

  /** 距到期天数:已过期为负数,无到期日返回 null。 */
  public static Long daysToExpiry(LocalDate expiresAt, LocalDate today) {
    if (expiresAt == null) return null;
    return ChronoUnit.DAYS.between(today, expiresAt);
  }

  public static void requireUploadedFile(String fileName, String storageKey) {
    if (fileName == null || fileName.isBlank() || storageKey == null || storageKey.isBlank()) {
      throw new IllegalArgumentException("请先上传证照文件后再提交资质档案");
    }
  }
}
