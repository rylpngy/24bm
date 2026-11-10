package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyFinalResponseRecords.Branch;
import java.util.*;

public final class AgencyMethodPolicy {
  private AgencyMethodPolicy() {}

  public static Set<String> permitted(String method) {
    return switch (Objects.toString(method, "")) {
      case "公开招标", "邀请招标" -> Set.of("comprehensive", "lowest_price");
      case "竞争性磋商" -> Set.of("comprehensive");
      case "竞争性谈判" -> Set.of("negotiation_price");
      case "询价" -> Set.of("price_comparison");
      case "单一来源" -> Set.of("consultation");
      default -> Set.of();
    };
  }

  public static Branch branch(String method, String evaluation) {
    if (!permitted(method).contains(evaluation)) throw new IllegalStateException("评审方法与采购方式不匹配");
    boolean finals = Set.of("竞争性谈判", "竞争性磋商").contains(method),
        competitive = !method.equals("单一来源");
    var remaining =
        switch (method) {
          case "邀请招标" -> List.of("邀请名单来源、适用核验及邀请送达专有程序", "受控推荐与报告");
          case "单一来源" -> List.of("适用理由、论证及公示适用性", "专业协商、价格合理性和质量保障", "协商结果确认与报告");
          case "询价" -> List.of("一次报价有效性及适用异常分支", "受控价格推荐与报告");
          default -> List.of("适用方式专有程序及人数条件", "受控推荐与报告");
        };
    return new Branch(
        method,
        evaluation,
        finals ? "final_original" : competitive ? "explicit_initial_layer" : "negotiated_record",
        finals,
        evaluation.equals("comprehensive"),
        competitive,
        remaining);
  }

  public static void finalResponse(String method, String evaluation) {
    if (!branch(method, evaluation).finalResponseRequired())
      throw new IllegalStateException("最终响应复核仅用于谈判/磋商；招标和询价不开放再次议价，单一来源使用专业协商程序");
  }
}
