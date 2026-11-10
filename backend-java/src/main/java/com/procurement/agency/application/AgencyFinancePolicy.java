package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyFinanceRecords.*;
import java.math.*;
import java.util.*;

public final class AgencyFinancePolicy {
  private AgencyFinancePolicy() {}

  public static BigDecimal money(BigDecimal v, boolean positive) {
    if (v == null
        || v.signum() < (positive ? 1 : 0)
        || v.scale() > 2
        || v.precision() - v.scale() > 20)
      throw new IllegalArgumentException("金额须为有效非负两位小数，流水金额必须大于零");
    return v.setScale(2);
  }

  public static BigDecimal fee(Calculation d) {
    if (d == null
        || d.discount() == null
        || d.discount().signum() < 0
        || d.discount().compareTo(BigDecimal.ONE) > 0
        || d.discount().scale() > 8) throw new IllegalArgumentException("折扣须为0到1之间的精确小数");
    BigDecimal amount =
        switch (Objects.toString(d.formula(), "")) {
          case "fixed" -> money(d.fixedAmount(), false);
          case "rate" -> {
            money(d.base(), false);
            if (d.rate() == null
                || d.rate().signum() < 0
                || d.rate().compareTo(BigDecimal.ONE) > 0
                || d.rate().scale() > 8) throw new IllegalArgumentException("费率须为0到1之间精确小数");
            yield d.base().multiply(d.rate());
          }
          default -> throw new IllegalArgumentException("须明确采用约定固定金额或比例，不能默认法定收费表");
        };
    return money(amount.multiply(d.discount()).setScale(2, RoundingMode.HALF_UP), false);
  }

  public static BigDecimal sum(List<Entry> entries, String kind) {
    return entries.stream()
        .filter(e -> e.status().equals("approved") && e.kind().equals(kind))
        .map(Entry::amount)
        .reduce(BigDecimal.ZERO, BigDecimal::add);
  }

  public static Summary summary(List<Account> accounts, List<Entry> entries) {
    var approved = accounts.stream().filter(a -> a.status().equals("approved")).toList();
    BigDecimal
        receivable =
            approved.stream()
                .filter(a -> a.kind().equals("receivable"))
                .map(Account::approved)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .add(sum(entries, "increase")),
        received = sum(entries, "receipt"),
        refund = sum(entries, "refund"),
        waiver = sum(entries, "waiver"),
        balance = receivable.subtract(waiver).subtract(received).add(refund),
        budget =
            accounts.stream()
                .filter(a -> a.kind().equals("cost") && a.budget() != null)
                .map(Account::budget)
                .reduce(BigDecimal.ZERO, BigDecimal::add),
        requested =
            accounts.stream()
                .filter(a -> a.kind().equals("cost"))
                .map(Account::requested)
                .reduce(BigDecimal.ZERO, BigDecimal::add),
        costApproved =
            approved.stream()
                .filter(a -> a.kind().equals("cost"))
                .map(Account::approved)
                .reduce(BigDecimal.ZERO, BigDecimal::add),
        actual = sum(entries, "incurred"),
        paid = sum(entries, "paid").subtract(sum(entries, "payment_refund"));
    return new Summary(
        receivable,
        received,
        refund,
        sum(entries, "invoice").subtract(sum(entries, "invoice_void")),
        waiver,
        balance.max(BigDecimal.ZERO),
        balance.negate().max(BigDecimal.ZERO),
        budget,
        requested,
        costApproved,
        actual,
        paid,
        actual.subtract(paid),
        receivable.subtract(waiver).subtract(actual));
  }

  public static void validateEntry(Account a, List<Entry> all, EntryDraft d) {
    money(d.amount(), true);
    var own = all.stream().filter(e -> e.accountId().equals(a.id())).toList();
    String kind = d.kind();
    if (!Set.of(
            "receipt",
            "refund",
            "invoice",
            "invoice_void",
            "waiver",
            "increase",
            "incurred",
            "paid",
            "payment_refund")
        .contains(Objects.toString(kind, ""))) throw new IllegalArgumentException("流水类型无效");
    if (a.kind().equals("receivable") && Set.of("incurred", "paid", "payment_refund").contains(kind)
        || a.kind().equals("cost") && !Set.of("incurred", "paid", "payment_refund").contains(kind))
      throw new IllegalArgumentException("流水类型与应收／成本账户不匹配");
    BigDecimal limit =
        switch (kind) {
          case "refund" -> sum(own, "receipt").subtract(sum(own, "refund"));
          case "invoice_void" -> sum(own, "invoice").subtract(sum(own, "invoice_void"));
          case "payment_refund" -> sum(own, "paid").subtract(sum(own, "payment_refund"));
          case "paid" ->
              sum(own, "incurred")
                  .min(a.approved())
                  .subtract(sum(own, "paid"))
                  .add(sum(own, "payment_refund"));
          case "waiver" -> a.approved().add(sum(own, "increase")).subtract(sum(own, "waiver"));
          default -> null;
        };
    if (limit != null && d.amount().compareTo(limit) > 0)
      throw new IllegalArgumentException("金额超过可退、可红冲、可减免或实际且批准的可付余额");
  }
}
