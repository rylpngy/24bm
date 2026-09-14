package com.procurement.ludongpoc.application;

import java.util.List;

public final class LudongPocArchiveMaterialCatalog {
  public static final String PROJECT_ATTACHMENT = "ludong_poc_project_attachment";
  public static final String MALL_CONFIRMATION = "ludong_poc_mall_confirmation";
  public static final String SUPPLEMENTARY_EVIDENCE = "ludong_poc_supplementary_evidence";

  public static final List<Category> CATEGORIES = List.of(
      new Category(PROJECT_ATTACHMENT, "项目附件", "02-项目附件", true),
      new Category(MALL_CONFIRMATION, "商城确认材料", "03-商城确认材料", true),
      new Category(SUPPLEMENTARY_EVIDENCE, "补充证明", "04-补充证明", false));

  private LudongPocArchiveMaterialCatalog() {
  }

  public record Category(String ownerType, String label, String archiveDirectory, boolean required) {
  }
}
