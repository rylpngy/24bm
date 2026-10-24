package com.procurement.tenant.domain;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

public final class TenantFeatureKey {
  public static final String RFQ = "rfq";
  public static final String ORDER = "order";
  public static final String FINANCE = "finance";
  public static final String METHODS_NONE = "method:none";
  public record Feature(String key, String label, boolean configurable) {}
  private static final List<Feature> FEATURES = List.of(
      new Feature(RFQ, "寻源立项", true), new Feature(ORDER, "订单履约", true),
      new Feature(FINANCE, "财务管理", true), new Feature("contract", "合同兼容标识", false),
      new Feature("mall", "商城兼容标识", false));
  private static final Set<String> LEGACY_KEYS = Set.of("workflow", "ludong-poc");

  public static List<Feature> all() { return FEATURES; }

  public static List<String> validate(List<String> features) {
    if (features == null) throw new IllegalArgumentException("功能清单不能为空");
    Set<String> allowed = new HashSet<>();
    FEATURES.forEach(f -> allowed.add(f.key()));
    allowed.addAll(LEGACY_KEYS);
    ProcurementMethodCatalog.all().forEach(m -> allowed.add(m.featureKey()));
    allowed.add(METHODS_NONE);
    Set<String> seen = new HashSet<>();
    for (String feature : features) {
      if (feature == null || !allowed.contains(feature)) throw new IllegalArgumentException("不支持的功能键: " + feature);
      if (!seen.add(feature)) throw new IllegalArgumentException("功能键重复: " + feature);
    }
    if (seen.contains(METHODS_NONE) && features.stream()
        .anyMatch(f -> f.startsWith(ProcurementMethodCatalog.METHOD_KEY_PREFIX) && !f.equals(METHODS_NONE))) {
      throw new IllegalArgumentException("全部关闭不能与已选采购方式同时配置");
    }
    return List.copyOf(features);
  }

  private TenantFeatureKey() {}
}
