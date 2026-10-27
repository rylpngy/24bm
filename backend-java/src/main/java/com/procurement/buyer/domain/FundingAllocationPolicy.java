package com.procurement.buyer.domain;

import java.math.BigDecimal;
import java.util.*;

public final class FundingAllocationPolicy {
  private FundingAllocationPolicy() {}

  public record Share(String fundId, BigDecimal amount) {}

  public static List<Share> requireTotal(List<Share> shares, BigDecimal total) {
    if (shares == null || shares.isEmpty() || shares.size() > 30)
      throw new IllegalArgumentException("请明确填写1至30项资金来源分摊");
    var ids = new HashSet<String>();
    BigDecimal sum = BigDecimal.ZERO;
    for (var line : shares) {
      if (line == null
          || line.fundId() == null
          || line.fundId().isBlank()
          || !ids.add(line.fundId())
          || line.amount() == null
          || line.amount().signum() <= 0
          || line.amount().stripTrailingZeros().scale() > 2)
        throw new IllegalArgumentException("资金来源不能重复，金额须为正数且精确到分");
      sum = sum.add(line.amount());
    }
    if (total == null || sum.compareTo(total) != 0)
      throw new IllegalArgumentException("资金分摊合计须等于本次业务金额");
    return shares.stream().sorted(Comparator.comparing(Share::fundId)).toList();
  }
}
