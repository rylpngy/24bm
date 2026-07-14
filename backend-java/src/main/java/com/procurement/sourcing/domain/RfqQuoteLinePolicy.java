package com.procurement.sourcing.domain;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 报价行与采购清单的一致性规则:供应商出价须依据采购清单。
 * 清单行(demandItemId → quantity)与报价行逐行核对——不可缺行、不可多行、数量不可改。
 * 清单为空的历史项目(无关联需求明细)不施加该规则,沿用自由报价以兼容存量数据。
 */
public final class RfqQuoteLinePolicy {

  private RfqQuoteLinePolicy() {}

  public static void requireQuoteMatchesRfqItems(
      Map<String, BigDecimal> rfqItemQuantities, List<QuotedLine> quotedLines, String rfqId) {
    if (rfqItemQuantities.isEmpty()) {
      return;
    }
    if (quotedLines == null || quotedLines.isEmpty()) {
      throw new IllegalArgumentException("请按采购清单逐行报价后再提交: " + rfqId);
    }

    Set<String> quotedItemIds = quotedLines.stream()
        .map(QuotedLine::demandItemId)
        .filter(id -> id != null && !id.isBlank())
        .collect(Collectors.toSet());

    if (quotedItemIds.size() != quotedLines.size()) {
      throw new IllegalArgumentException("报价行须逐条对应采购清单行,存在未关联清单行或重复行: " + rfqId);
    }

    List<String> missing = rfqItemQuantities.keySet().stream()
        .filter(itemId -> !quotedItemIds.contains(itemId))
        .toList();
    if (!missing.isEmpty()) {
      throw new IllegalArgumentException(
          "采购清单尚有 " + missing.size() + " 行未报价,须对清单全部行项报价: " + rfqId);
    }

    for (QuotedLine line : quotedLines) {
      BigDecimal expected = rfqItemQuantities.get(line.demandItemId());
      if (expected == null) {
        throw new IllegalArgumentException("报价行不在本项目采购清单内: " + line.demandItemId());
      }
      if (line.quantity() == null || expected.compareTo(line.quantity()) != 0) {
        throw new IllegalArgumentException(
            "报价数量须与采购清单一致(清单 " + expected.stripTrailingZeros().toPlainString() + "): "
                + line.demandItemId());
      }
    }
  }

  /** 报价行的清单归属与数量(与 api 层解耦,便于纯函数校验)。 */
  public record QuotedLine(String demandItemId, BigDecimal quantity) {}
}
