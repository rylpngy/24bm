package com.procurement;

import static org.assertj.core.api.Assertions.*;

import com.fasterxml.jackson.databind.*;
import com.procurement.order.api.OrderSettlementContracts.*;
import com.procurement.order.application.*;
import java.math.BigDecimal;
import java.util.*;
import org.junit.jupiter.api.Test;

class OrderSettlementAllocationTests {
  final ObjectMapper json = new ObjectMapper();
  final OrderSettlementPolicy policy = new OrderSettlementPolicy(json);
  final OrderSettlementAllocationPolicy p = new OrderSettlementAllocationPolicy(json);

  JsonNode baseline() {
    return policy.tree(
        """
{"amount":200,"supplierId":"s","contracts":[],"lines":[{"id":"line","quantity":2,"unitPrice":100,"lineAmount":200,"shipped":2,"received":2,"qualified":2}],
 "invoices":[{"id":"a","amount":100,"invoice_no":"A","payment_status":"已付款"},{"id":"b","amount":100,"invoice_no":"B","payment_status":"待付款"}],
 "payments":[{"invoice_id":"a","amount":100}]}
""");
  }

  List<Allocation> allocations() {
    return List.of(
        new Allocation("a", BigDecimal.ZERO), new Allocation("b", new BigDecimal("100")));
  }

  Evidence evidence(String kind, int amount, String source) {
    return new Evidence(
        "id",
        "s",
        kind,
        BigDecimal.valueOf(amount),
        "ref",
        "file",
        "sha",
        "remark",
        "user",
        null,
        source);
  }

  EvidenceRequest request(String kind, int amount, String source) {
    return new EvidenceRequest(
        "key", kind, BigDecimal.valueOf(amount), "ref", "file", "remark", source);
  }

  @Test
  void noContractAndMultipleInvoicesRetainRealFinancialFacts() {
    var a = policy.assess(policy.write(baseline()), null);
    assertThat(a.kind()).isEqualTo("order_closeout");
    assertThat(a.contractId()).isNull();
    assertThat(a.blockers()).isEmpty();
    assertThat(a.paid()).isEqualByComparingTo("100");
  }

  @Test
  void aggregateBalanceCannotHideRefundOnOneInvoiceAndPaymentOnAnother() {
    var plan = p.plan(baseline(), new BigDecimal("100"), BigDecimal.ZERO, allocations());
    assertThat(
            p.completionBlockers(
                plan, List.of(evidence("invoice", 0, "a"), evidence("invoice", 100, "b"))))
        .hasSize(2);
    p.validate(plan, List.of(), request("refund", 100, "a"));
    p.validate(plan, List.of(), request("payment", 100, "b"));
    var items =
        List.of(
            evidence("refund", 100, "a"),
            evidence("payment", 100, "b"),
            evidence("invoice", 0, "a"),
            evidence("invoice", 100, "b"));
    assertThat(p.completionBlockers(plan, items)).isEmpty();
  }

  @Test
  void noCrossInvoiceCashOrOverpaymentOrDuplicateProof() {
    var plan = p.plan(baseline(), new BigDecimal("100"), BigDecimal.ZERO, allocations());
    for (var r :
        List.of(
            request("refund", 1, "b"),
            request("payment", 1, "a"),
            request("refund", 101, "a"),
            request("invoice", 100, "other"),
            request("compensation_receipt", 0, "a")))
      assertThatThrownBy(() -> p.validate(plan, List.of(), r)).isInstanceOf(RuntimeException.class);
    assertThatThrownBy(
            () ->
                p.validate(plan, List.of(evidence("invoice", 0, "a")), request("invoice", 0, "a")))
        .isInstanceOf(IllegalStateException.class);
  }

  @Test
  void explicitCompletePlanMustBalanceAndCannotOverallocateOrReferenceOtherOrder() {
    assertThatThrownBy(() -> p.plan(baseline(), BigDecimal.TEN, BigDecimal.ZERO, null))
        .hasMessageContaining("逐票");
    for (var rows :
        List.of(
            List.of(new Allocation("a", BigDecimal.TEN)),
            List.of(
                new Allocation("a", new BigDecimal("101")), new Allocation("b", BigDecimal.ZERO)),
            List.of(
                new Allocation("a", BigDecimal.TEN),
                new Allocation("b", BigDecimal.ZERO),
                new Allocation("other", BigDecimal.ZERO)),
            List.of(new Allocation("a", BigDecimal.TEN), new Allocation("a", BigDecimal.ZERO))))
      assertThatThrownBy(() -> p.plan(baseline(), BigDecimal.TEN, BigDecimal.ZERO, rows))
          .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void unbilledAndCompensationUseSeparateBalances() {
    var b = baseline().deepCopy();
    ((com.fasterxml.jackson.databind.node.ArrayNode) b.path("invoices")).remove(1);
    var plan =
        p.plan(
            b,
            new BigDecimal("100"),
            new BigDecimal("10"),
            List.of(
                new Allocation("a", new BigDecimal("60")),
                new Allocation("~unbilled", new BigDecimal("40"))));
    assertThat(plan).hasSize(3);
    var items =
        List.of(
            evidence("refund", 40, "a"),
            evidence("payment", 40, "~unbilled"),
            evidence("payment", 10, "~compensation"),
            evidence("invoice", 60, "a"),
            evidence("invoice", 40, "~unbilled"),
            evidence("compensation_receipt", 10, "~compensation"));
    assertThat(p.completionBlockers(plan, items)).isEmpty();
    assertThat(p.basis(b).toString()).doesNotContain("payments", "invoice_id");
  }

  @Test
  void legacySingleFullInvoiceStillUsesOriginalPolicy() {
    var b = baseline().deepCopy();
    ((com.fasterxml.jackson.databind.node.ArrayNode) b.path("invoices")).remove(1);
    ((com.fasterxml.jackson.databind.node.ObjectNode) b.path("invoices").get(0))
        .put("amount", 200)
        .put("payment_status", "部分付款");
    assertThat(p.plan(b, new BigDecimal("100"), BigDecimal.ZERO, null)).isNull();
  }

  @Test
  void excessiveInvoiceFacesAndUnknownPaidStateStillBlock() {
    var b = baseline().deepCopy();
    ((com.fasterxml.jackson.databind.node.ObjectNode) b.path("invoices").get(0)).put("amount", 201);
    assertThat(policy.assess(policy.write(b), null).blockers()).isNotEmpty();
  }
}
