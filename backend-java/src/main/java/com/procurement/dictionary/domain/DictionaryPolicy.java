package com.procurement.dictionary.domain;

import java.util.Map;
import java.util.Set;

/**
 * 字典维护规则(D-4):
 * - type/code 为主键,创建后不可修改,只能停用后新增(保证既有业务数据引用不失效);
 * - code 仅允许小写字母/数字/下划线/短横(供程序识别),type 同规则;
 * - 名称非空;状态限 active / inactive —— 删除一律以停用替代。
 */
public final class DictionaryPolicy {

  public static final String STATUS_ACTIVE = "active";
  public static final String STATUS_INACTIVE = "inactive";
  private static final String KEY_PATTERN = "[a-z0-9_-]+";
  private static final Map<String, Set<String>> SYSTEM_CODES = Map.of(
      "payment_status", Set.of("pending", "partial_paid", "paid"),
      "announcement_audience", Set.of("all", "buyer", "supplier"),
      "supplier_user_status", Set.of("active", "inactive"),
      "attachment_visibility", Set.of("tenant", "buyer_internal", "supplier_shared"));

  public static boolean extensible(String type) { return !SYSTEM_CODES.containsKey(type); }

  public static void requireSupportedCode(String type, String code) {
    if (SYSTEM_CODES.containsKey(type) && !SYSTEM_CODES.get(type).contains(code)) {
      throw new IllegalArgumentException("系统字典不支持新增业务状态: " + type + "/" + code);
    }
  }

  private DictionaryPolicy() {}

  public static void requireValidKey(String value, String field) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException(field + "不能为空");
    }
    if (!value.matches(KEY_PATTERN)) {
      throw new IllegalArgumentException(field + "仅允许小写字母、数字、下划线与短横: " + value);
    }
  }

  public static void requireValidLabel(String label) {
    if (label == null || label.isBlank()) {
      throw new IllegalArgumentException("显示名称不能为空");
    }
  }

  public static String normalizeStatus(String status) {
    if (status == null || status.isBlank() || STATUS_ACTIVE.equals(status)) {
      return STATUS_ACTIVE;
    }
    if (STATUS_INACTIVE.equals(status)) {
      return STATUS_INACTIVE;
    }
    throw new IllegalArgumentException("状态须为 active 或 inactive: " + status);
  }

  public static void requireAbsent(DictionaryEntry existing, String type, String code) {
    if (existing != null) {
      throw new IllegalStateException("该字典条目已存在(可编辑或停用): " + type + "/" + code);
    }
  }

  public static void requirePresent(DictionaryEntry existing, String type, String code) {
    if (existing == null) {
      throw new IllegalArgumentException("字典条目不存在: " + type + "/" + code);
    }
  }
}
