package com.procurement;

import static org.assertj.core.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.procurement.order.api.OrderSettlementContracts.Price;
import com.procurement.order.application.OrderSettlementPolicy;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

class OrderSettlementPolicyTests {
  @Test
  void publicSnapshotNeverExposesRawContractOrFinancialRows() {
    var mapper = new ObjectMapper();
    var original =
        mapper.convertValue(
            java.util.Map.of(
                "snapshot",
                "{\"assessment\":{\"baseline\":{\"payments\":[{\"bank\":\"private-bank-reference\"}]},\"lines\":[{\"id\":\"line\",\"retainedQuantity\":1}]}}"),
            com.procurement.order.api.OrderSettlementContracts.Entry.class);
    var result = p.sanitizedEntry(original);
    assertThat(result.snapshot())
        .contains("retainedQuantity")
        .doesNotContain("baseline", "private-bank-reference");
    assertThat(original.snapshot()).contains("private-bank-reference");
  }

  final OrderSettlementPolicy p = new OrderSettlementPolicy(new ObjectMapper());

  ObjectNode baseline() {
    return (ObjectNode)
        p.tree(
            """
{"amount":200,"supplierId":"supplier","contracts":[{"id":"contract","status":"已生效","amount":200,"supplier_id":"supplier","archive_status":"待归档"}],"lines":[{"id":"line","description":"电脑","quantity":2,"unitPrice":100,"lineAmount":200,"shipped":1,"received":1,"qualified":1,"skuId":"sku","reserved":2}],"invoices":[],"payments":[]}
""");
  }

  @Test
  void partialRetainsActualReceiptAndTerminatesOnlyBalance() {
    var a = p.assess(p.write(baseline()), null);
    assertThat(a.blockers()).isEmpty();
    assertThat(a.goods()).isEqualByComparingTo("100");
    assertThat(a.kind()).isEqualTo("reduction");
    assertThat(p.tree(a.snapshot()).path("lines").get(0).path("cancelledQuantity").decimalValue())
        .isEqualByComparingTo("1");
  }

  @Test
  void agreedDiscountDoesNotOverwriteOriginalUnitPrice() {
    var a = p.assess(p.write(baseline()), List.of(new Price("line", new BigDecimal("80"))));
    assertThat(a.goods()).isEqualByComparingTo("80");
    assertThat(
            p.tree(a.snapshot()).path("baseline").path("lines").get(0).path("unitPrice").intValue())
        .isEqualTo(100);
  }

  @Test
  void rejectsInTransitAndUnqualifiedGoods() {
    var b = baseline();
    ((ObjectNode) b.path("lines").get(0)).put("received", 0);
    assertThat(p.assess(p.write(b), null).blockers()).anyMatch(x -> x.contains("在途"));
  }

  @Test
  void unknownInventoryIsNotGuessedButExplicitUntrackedZeroIsAllowed() {
    var b = baseline();
    var l = (ObjectNode) b.path("lines").get(0);
    l.putNull("reserved");
    assertThat(p.assess(p.write(b), null).blockers()).anyMatch(x -> x.contains("库存"));
    l.put("reserved", 0);
    assertThat(p.assess(p.write(b), null).blockers()).isEmpty();
  }

  @Test
  void rejectsUnknownOrDuplicatePriceAndIncrease() {
    for (var prices :
        List.of(
            List.of(new Price("other", BigDecimal.ONE)),
            List.of(new Price("line", new BigDecimal("101"))),
            List.of(new Price("line", BigDecimal.ONE), new Price("line", BigDecimal.TEN))))
      assertThat(p.assess(p.write(baseline()), prices).blockers()).isNotEmpty();
  }

  @Test
  void legacyPaidWithoutLedgerIsNotZero() {
    var b = baseline();
    b.set("invoices", p.tree("[{\"id\":\"invoice\",\"amount\":200,\"payment_status\":\"已付款\"}]"));
    assertThat(p.assess(p.write(b), null).blockers()).anyMatch(x -> x.contains("历史付款"));
  }

  @Test
  void originalOrderAndContractMustReconcile() {
    var b = baseline();
    b.put("amount", 201);
    assertThat(p.assess(p.write(b), null).blockers()).hasSize(2);
  }

  @Test
  void draftVoidCannotEraseReceivedGoods() {
    var b = baseline();
    ((ObjectNode) b.path("contracts").get(0)).put("status", "草案");
    assertThat(p.assess(p.write(b), null).blockers()).anyMatch(x -> x.contains("草案"));
  }
}
