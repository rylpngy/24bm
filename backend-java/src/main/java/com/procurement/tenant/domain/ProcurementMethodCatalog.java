package com.procurement.tenant.domain;

import java.util.List;
import java.util.Set;

/**
 * 采购方式注册表(M-0):方式与「能力键 / 工作台模块 / 是否进创建向导」的**单一事实源**。
 *
 * <p>租户按方式自由组合:开关落在 tenants.enabled_features,后端在立项入口按能力键放行,
 * 前端导航与创建向导读同一份清单渲染——两侧口径一致,关掉的方式不是藏起来而是真的不可用。
 */
public final class ProcurementMethodCatalog {

  /** 能力键前缀:出现任一 method:* 键即视为「按方式精细配置」。 */
  public static final String METHOD_KEY_PREFIX = "method:";

  public record MethodDefinition(
      /** 业务方式码,与 RfqMethod / 招标锚点口径一致。 */
      String code,
      String label,
      /** 能力键,写进 tenants.enabled_features。 */
      String featureKey,
      /** 启用该方式后可见的工作台模块 id(与前端 navigation 的 id 对齐)。 */
      List<String> moduleIds,
      /** 是否出现在采购立项向导的方式选择里(招标走独立编制入口,不进向导)。 */
      boolean inCreateWizard) {}

  public static final MethodDefinition COMPARE = new MethodDefinition(
      "询比", "询比采购", "method:compare", List.of("rfqs"), true);
  public static final MethodDefinition AUCTION = new MethodDefinition(
      "竞价", "竞价采购", "method:auction", List.of("auctions"), true);
  public static final MethodDefinition MALL = new MethodDefinition(
      "商城", "商城直采", "method:mall", List.of("mall"), true);
  public static final MethodDefinition SINGLE_SOURCE = new MethodDefinition(
      "单一来源", "单一来源", "method:single-source", List.of(), true);
  public static final MethodDefinition TENDER = new MethodDefinition(
      "招标", "招标采购", "method:tender", List.of("tenders"), false);

  private static final List<MethodDefinition> ALL =
      List.of(COMPARE, AUCTION, MALL, SINGLE_SOURCE, TENDER);

  /**
   * 存量租户兼容:老数据里的模块级键(如 "mall")等价于对应方式键。
   * 询比/竞价/单一来源在老口径下统称 "rfq",不做逐一映射——见 {@link #enabledMethods}
   * 的「无 method:* 键即全开」规则。
   */
  private static final Set<String> LEGACY_MALL_KEYS = Set.of("mall");

  private ProcurementMethodCatalog() {}

  public static List<MethodDefinition> all() {
    return ALL;
  }

  public static MethodDefinition byCode(String code) {
    return ALL.stream()
        .filter(m -> m.code().equals(code))
        .findFirst()
        .orElse(null);
  }

  /**
   * 解析租户启用的方式。
   *
   * <p>**向后兼容规则**:能力清单里一个 method:* 键都没有时视为「未做精细配置」,全部方式放行
   * ——存量租户不会因为本次改造突然少掉采购方式。一旦出现任意 method:* 键,即按清单精确判定。
   */
  public static List<MethodDefinition> enabledMethods(List<String> enabledFeatures) {
    List<String> features = enabledFeatures == null ? List.of() : enabledFeatures;
    boolean configured = features.stream().anyMatch(f -> f.startsWith(METHOD_KEY_PREFIX));
    if (!configured) {
      return ALL;
    }
    return ALL.stream()
        .filter(m -> features.contains(m.featureKey())
            || (MALL.equals(m) && features.stream().anyMatch(LEGACY_MALL_KEYS::contains)))
        .toList();
  }

  public static boolean isMethodEnabled(List<String> enabledFeatures, String code) {
    return enabledMethods(enabledFeatures).stream().anyMatch(m -> m.code().equals(code));
  }

  /** 启用方式对应的工作台模块 id;与方式无关的模块(订单、财务等)不在此列,由既有权限门禁管。 */
  public static List<String> methodModuleIds(List<String> enabledFeatures) {
    return enabledMethods(enabledFeatures).stream()
        .flatMap(m -> m.moduleIds().stream())
        .distinct()
        .toList();
  }

  /** 所有受方式开关管辖的模块 id——前端据此判断「该模块是否需要按方式过滤」。 */
  public static List<String> allMethodModuleIds() {
    return ALL.stream().flatMap(m -> m.moduleIds().stream()).distinct().toList();
  }
}
