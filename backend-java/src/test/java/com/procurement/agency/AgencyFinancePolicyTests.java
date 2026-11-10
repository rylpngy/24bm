package com.procurement.agency;

import static org.assertj.core.api.Assertions.*;

import com.procurement.agency.application.AgencyFinancePolicy;
import com.procurement.agency.domain.AgencyFinanceRecords.*;
import java.math.BigDecimal;
import java.util.*;
import org.junit.jupiter.api.Test;

class AgencyFinancePolicyTests {
  BigDecimal n(String v) {
    return new BigDecimal(v);
  }

  Calculation rule(String mode, String base, String rate, String fixed, String discount) {
    return new Calculation(
        mode,
        base == null ? null : n(base),
        rate == null ? null : n(rate),
        fixed == null ? null : n(fixed),
        n(discount),
        "v1",
        "actual agreement",
        "tax included",
        "actual trigger",
        "payer",
        "recipient",
        "proof",
        true,
        "key");
  }

  Account a(String kind, String amount) {
    return new Account(
        "a",
        "t",
        "p",
        kind,
        "other",
        "CNY",
        n("200"),
        n(amount),
        n(amount),
        "approved",
        3,
        "{}",
        "hash",
        null,
        "owner",
        null);
  }

  Entry e(String kind, String amount) {
    return new Entry(
        kind,
        "t",
        "p",
        "a",
        kind,
        n(amount),
        null,
        "f",
        "h",
        "{}",
        "h",
        "approved",
        1,
        null,
        "u",
        null);
  }

  EntryDraft d(String kind, String amount) {
    return new EntryDraft(
        kind, n(amount), null, "f", "counter", "ref", "reason", true, false, Map.of(), "key");
  }

  @Test
  void roundsOnlyAfterRateAndDiscount() {
    assertThat(AgencyFinancePolicy.fee(rule("rate", "999.99", "0.015", null, "0.8")))
        .isEqualByComparingTo("12.00");
  }

  @Test
  void fixedDoesNotInventRateOrBase() {
    assertThat(AgencyFinancePolicy.fee(rule("fixed", null, null, "100.01", "0.9")))
        .isEqualByComparingTo("90.01");
  }

  @Test
  void zeroIsDistinctFromUnknown() {
    assertThat(AgencyFinancePolicy.fee(rule("fixed", null, null, "0", "1"))).isZero();
    assertThatThrownBy(() -> AgencyFinancePolicy.fee(rule("fixed", null, null, null, "1")))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void unsupportedFormulaAndInvalidDiscountFail() {
    assertThatThrownBy(() -> AgencyFinancePolicy.fee(rule("legal_default", null, null, "100", "1")))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> AgencyFinancePolicy.fee(rule("fixed", null, null, "100", "1.1")))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void invoiceNeverCountsAsCashAndOverpaymentIsVisible() {
    var summary =
        AgencyFinancePolicy.summary(
            List.of(a("receivable", "100")), List.of(e("invoice", "100"), e("receipt", "120")));
    assertThat(summary.received()).isEqualByComparingTo("120");
    assertThat(summary.overpaid()).isEqualByComparingTo("20");
    assertThat(summary.outstanding()).isZero();
  }

  @Test
  void splitCashRefundWaiverAndIncreaseHaveSeparateEffects() {
    var summary =
        AgencyFinancePolicy.summary(
            List.of(a("receivable", "100")),
            List.of(
                e("receipt", "30"),
                e("receipt", "40"),
                e("refund", "10"),
                e("waiver", "5"),
                e("increase", "20")));
    assertThat(summary.outstanding()).isEqualByComparingTo("55");
    assertThat(summary.refunded()).isEqualByComparingTo("10");
  }

  @Test
  void refundCannotExceedActualNetReceipts() {
    assertThatThrownBy(
            () ->
                AgencyFinancePolicy.validateEntry(
                    a("receivable", "100"),
                    List.of(e("receipt", "30"), e("refund", "10")),
                    d("refund", "21")))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void costBudgetRequestApprovalActualAndPaymentStaySeparate() {
    var summary =
        AgencyFinancePolicy.summary(
            List.of(a("cost", "100")),
            List.of(e("incurred", "80"), e("paid", "40"), e("payment_refund", "5")));
    assertThat(summary.costBudget()).isEqualByComparingTo("200");
    assertThat(summary.costActual()).isEqualByComparingTo("80");
    assertThat(summary.costPaid()).isEqualByComparingTo("35");
    assertThat(summary.costPayable()).isEqualByComparingTo("45");
  }

  @Test
  void paymentRequiresBothActualAndApprovedBalance() {
    assertThatThrownBy(
            () ->
                AgencyFinancePolicy.validateEntry(
                    a("cost", "50"), List.of(e("incurred", "80")), d("paid", "51")))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void precisionAndCrossKindAbuseRejected() {
    assertThatThrownBy(() -> AgencyFinancePolicy.money(n("0.001"), true))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(
            () -> AgencyFinancePolicy.validateEntry(a("cost", "10"), List.of(), d("receipt", "1")))
        .isInstanceOf(IllegalArgumentException.class);
  }
}
