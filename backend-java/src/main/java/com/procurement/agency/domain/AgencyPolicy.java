package com.procurement.agency.domain;

import java.math.BigDecimal;
import java.time.ZoneId;
import java.util.*;

public final class AgencyPolicy {
  public static final List<String> METHODS =
      List.of("公开招标", "邀请招标", "竞争性谈判", "竞争性磋商", "询价", "单一来源");
  public static final Set<String> EDITABLE = Set.of("draft", "rejected", "withdrawn");

  private AgencyPolicy() {}

  public static void amount(BigDecimal n, String field) {
    if (n != null && (n.signum() < 0 || n.scale() > 2 || n.precision() > 20))
      throw new IllegalArgumentException(field + "须为非负金额，最多两位小数");
  }

  public static void expected(long actual, Long expected) {
    if (expected == null || actual != expected)
      throw new AgencyConflictException("档案已更新，请刷新后重试；当前版本：" + actual);
  }

  public static void text(String s, int max, String field) {
    if (s != null && s.length() > max) throw new IllegalArgumentException(field + "超过长度限制");
  }

  public static boolean blank(String s) {
    return s == null || s.isBlank();
  }

  public static void pattern(String pattern, String zone) {
    if (pattern == null || pattern.length() > 120) throw new IllegalArgumentException("编号格式不合法");
    String stripped = pattern;
    for (String token : List.of("{category}", "{object}", "{yyyyMM}", "{serial}")) {
      if (pattern.indexOf(token) < 0 || pattern.indexOf(token) != pattern.lastIndexOf(token))
        throw new IllegalArgumentException("编号格式须各含一次" + token);
      stripped = stripped.replace(token, "");
    }
    if (!stripped.matches("[-_/A-Za-z0-9]*"))
      throw new IllegalArgumentException("编号格式仅允许代码、年月、流水和安全分隔符");
    try {
      ZoneId.of(zone);
    } catch (Exception e) {
      throw new IllegalArgumentException("无效业务时区");
    }
  }

  public static String number(
      String pattern, String category, String object, String yyyyMM, int serial) {
    if (serial < 1 || serial > 9999)
      throw new IllegalStateException("公司年度流水已超过9999，请管理员配置扩位方案后处理，禁止循环取号");
    return pattern
        .replace("{category}", category)
        .replace("{object}", object)
        .replace("{yyyyMM}", yyyyMM)
        .replace("{serial}", String.format(java.util.Locale.ROOT, "%04d", serial));
  }
}
