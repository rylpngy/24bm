package com.procurement.finance.domain;

import java.math.*;
import java.util.*;

public final class InvoiceInstallmentPolicy {
  public record Balance(
      String id,
      String description,
      String unit,
      BigDecimal quantity,
      BigDecimal unitPrice,
      BigDecimal lineAmount,
      BigDecimal invoicedQuantity,
      BigDecimal invoicedAmount) {}

  public record Selection(String id, BigDecimal quantity) {}

  public record IssuedLine(Balance original, BigDecimal quantity, BigDecimal amount) {}

  public static List<IssuedLine> select(
      List<Balance> lines, List<Selection> selections, BigDecimal claimed) {
    if (selections == null || selections.isEmpty())
      throw new IllegalArgumentException("请选择本次开票明细和数量");
    var available = new HashMap<String, Balance>();
    for (var l : lines) available.put(l.id(), l);
    var result = new ArrayList<IssuedLine>();
    var used = new HashSet<String>();
    BigDecimal total = BigDecimal.ZERO;
    for (var s : selections) {
      var l = available.get(s.id());
      if (l == null || !used.add(s.id())) throw new IllegalArgumentException("开票行不属于本订单或重复");
      if (s.quantity() == null
          || s.quantity().signum() <= 0
          || s.quantity().scale() > 4
          || s.quantity().add(l.invoicedQuantity()).compareTo(l.quantity()) > 0)
        throw new IllegalArgumentException("本次开票数量须大于零且不超过剩余可开数量");
      BigDecimal amount = s.quantity().multiply(l.unitPrice()).setScale(2, RoundingMode.HALF_UP);
      BigDecimal remaining = l.quantity().subtract(l.invoicedQuantity()).subtract(s.quantity());
      if (amount.signum() < 0
          || l.invoicedAmount()
                  .add(amount)
                  .add(remaining.multiply(l.unitPrice()).setScale(2, RoundingMode.HALF_UP))
                  .compareTo(l.lineAmount())
              != 0) throw new IllegalArgumentException("拆分数量产生分币差异，请调整本次开票数量后重试");
      result.add(new IssuedLine(l, s.quantity(), amount));
      total = total.add(amount);
    }
    if (claimed == null || total.signum() <= 0 || total.compareTo(claimed) != 0)
      throw new IllegalArgumentException("开票金额须大于零且等于本次明细金额合计");
    return List.copyOf(result);
  }
}
