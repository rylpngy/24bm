package com.procurement.ludongpoc.application;

import java.util.List;
import java.util.ArrayList;
import java.util.HashSet;
import com.fasterxml.jackson.databind.JsonNode;

public final class LudongPocArchiveMaterialCatalog {
  public static final String PROJECT_ATTACHMENT = "ludong_poc_project_attachment";
  public static final String MALL_CONFIRMATION = "ludong_poc_mall_confirmation";
  public static final String SUPPLEMENTARY_EVIDENCE = "ludong_poc_supplementary_evidence";

  public static final List<Category> CATEGORIES = List.of(
      new Category(PROJECT_ATTACHMENT, "项目附件", "02-项目附件", true),
      new Category(MALL_CONFIRMATION, "商城确认材料", "03-商城确认材料", true),
      new Category(SUPPLEMENTARY_EVIDENCE, "补充证明", "04-补充证明", false));

  public static List<Category> supported() {
    var result = new ArrayList<>(CATEGORIES);
    for (int i = 1; i <= 5; i++) result.add(new Category("ludong_poc_custom_" + i,
        "自定义材料" + i, "0" + (4 + i) + "-自定义材料" + i, false));
    return List.copyOf(result);
  }

  public static List<Category> parse(JsonNode root) {
    JsonNode values = root.path("attachmentCategories");
    if (values.isMissingNode() || values.isNull()) return CATEGORIES;
    if (!values.isArray() || values.size() < 3 || values.size() > 8) {
      throw new IllegalArgumentException("附件分类须保留三类基础材料，最多增加五类自定义材料");
    }
    var result = new ArrayList<Category>();
    var ids = new HashSet<String>();
    for (JsonNode value : values) {
      String id = value.path("id").asText();
      String label = value.path("label").asText().strip();
      Category base = supported().stream().filter(item -> item.id().equals(id)).findFirst()
          .orElseThrow(() -> new IllegalArgumentException("不支持的附件分类编码：" + id));
      if (!ids.add(id) || label.isBlank() || label.length() > 40
          || label.matches(".*[\\\\/\\r\\n\\x00].*") || label.contains("..")
          || !value.path("required").isBoolean()) throw new IllegalArgumentException("附件分类编码重复、名称不合法或未设置必备标识");
      String prefix = base.archiveDirectory().substring(0, 3);
      result.add(new Category(base.ownerType(), label, prefix + label, value.path("required").asBoolean()));
    }
    if (!ids.containsAll(CATEGORIES.stream().map(Category::id).toList())) throw new IllegalArgumentException("基础附件分类不能删除");
    return List.copyOf(result);
  }

  private LudongPocArchiveMaterialCatalog() {
  }

  public record Category(String ownerType, String label, String archiveDirectory, boolean required) {
    @com.fasterxml.jackson.annotation.JsonProperty("id")
    public String id() { return ownerType.substring("ludong_poc_".length()); }
  }
}
