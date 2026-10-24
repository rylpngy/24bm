package com.procurement.platform.domain;

import java.util.List;
import java.util.Map;

public final class TenantPlanCatalog {
  public record Plan(String code, String label) {}
  private static final List<Plan> PLANS = List.of(
      new Plan("MVP", "MVP"), new Plan("Growth", "标准版"), new Plan("Enterprise", "企业版"));
  private static final Map<String, String> ALIASES = Map.of(
      "MVP", "MVP", "Growth", "Growth", "Enterprise", "Enterprise", "标准版", "Growth", "企业版", "Enterprise");

  private TenantPlanCatalog() {}

  public static List<Plan> all() { return PLANS; }

  public static String canonical(String value) {
    String result = value == null ? null : ALIASES.get(value.trim());
    if (result == null) throw new IllegalArgumentException("不支持的套餐: " + value);
    return result;
  }

  public static int rank(String value) {
    String canonical = value == null ? "" : ALIASES.getOrDefault(value, value);
    for (int i = 0; i < PLANS.size(); i++) if (PLANS.get(i).code().equals(canonical)) return i;
    return -1;
  }
}
