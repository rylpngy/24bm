package com.procurement;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.procurement.sourcing.domain.RfqQuoteLinePolicy;
import com.procurement.sourcing.domain.RfqQuoteLinePolicy.QuotedLine;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

// 出价须依据采购清单:不可漏行、不可多行、数量以清单为准。
class RfqQuoteLinePolicyTests {

  private static final Map<String, BigDecimal> LIST = Map.of(
      "item-monitor", new BigDecimal("5"),
      "item-server", new BigDecimal("2"));

  @Test
  void acceptsQuoteCoveringEveryListLineWithListQuantities() {
    assertThatCode(() -> RfqQuoteLinePolicy.requireQuoteMatchesRfqItems(
        LIST,
        List.of(
            new QuotedLine("item-monitor", new BigDecimal("5")),
            new QuotedLine("item-server", new BigDecimal("2.00"))),
        "rfq-1"))
        .doesNotThrowAnyException();
  }

  @Test
  void rejectsQuoteMissingListLines() {
    assertThatThrownBy(() -> RfqQuoteLinePolicy.requireQuoteMatchesRfqItems(
        LIST, List.of(new QuotedLine("item-monitor", new BigDecimal("5"))), "rfq-1"))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("须对清单全部行项报价");
  }

  @Test
  void rejectsQuantityDifferentFromPurchaseList() {
    assertThatThrownBy(() -> RfqQuoteLinePolicy.requireQuoteMatchesRfqItems(
        LIST,
        List.of(
            new QuotedLine("item-monitor", new BigDecimal("99")),
            new QuotedLine("item-server", new BigDecimal("2"))),
        "rfq-1"))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("报价数量须与采购清单一致");
  }

  @Test
  void rejectsLineOutsidePurchaseList() {
    assertThatThrownBy(() -> RfqQuoteLinePolicy.requireQuoteMatchesRfqItems(
        LIST,
        List.of(
            new QuotedLine("item-monitor", new BigDecimal("5")),
            new QuotedLine("item-server", new BigDecimal("2")),
            new QuotedLine("item-extra", new BigDecimal("1"))),
        "rfq-1"))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("报价行不在本项目采购清单内");
  }

  @Test
  void rejectsEmptyQuoteWhenListPresent() {
    assertThatThrownBy(() -> RfqQuoteLinePolicy.requireQuoteMatchesRfqItems(LIST, List.of(), "rfq-1"))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("请按采购清单逐行报价");
  }

  @Test
  void rejectsLinesWithoutListBinding() {
    assertThatThrownBy(() -> RfqQuoteLinePolicy.requireQuoteMatchesRfqItems(
        LIST,
        List.of(
            new QuotedLine(null, new BigDecimal("5")),
            new QuotedLine("item-server", new BigDecimal("2"))),
        "rfq-1"))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("存在未关联清单行或重复行");
  }

  // 存量兼容:无清单明细的历史项目沿用自由报价,不施加清单规则。
  @Test
  void skipsRuleWhenRfqHasNoPurchaseList() {
    assertThatCode(() -> RfqQuoteLinePolicy.requireQuoteMatchesRfqItems(
        Map.of(), List.of(new QuotedLine(null, new BigDecimal("1"))), "rfq-legacy"))
        .doesNotThrowAnyException();
  }
}
