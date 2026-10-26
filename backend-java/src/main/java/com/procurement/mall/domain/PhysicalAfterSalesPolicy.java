package com.procurement.mall.domain;

import java.util.List;

public final class PhysicalAfterSalesPolicy {
  private PhysicalAfterSalesPolicy() {}

  public static List<String> actions(String type, String status, String last, boolean supplier) {
    if (!List.of("退货", "换货").contains(type) || !List.of("处理中", "已完成").contains(status))
      return List.of();
    // Legacy completion is not proof: allow evidence backfill, never fabricate prior events.
    return switch (last) {
      case "", "inspection_fail" -> supplier ? List.of() : List.of("return_dispatch");
      case "return_dispatch" -> supplier ? List.of("return_receipt") : List.of();
      case "return_receipt" ->
          supplier && type.equals("换货") ? List.of("replacement_dispatch") : List.of();
      case "replacement_dispatch" ->
          supplier ? List.of() : List.of("inspection_pass", "inspection_fail");
      default -> List.of();
    };
  }

  public static boolean ready(String type, String last) {
    return type.equals("退货")
        ? last.equals("return_receipt")
        : type.equals("换货") && last.equals("inspection_pass");
  }
}
