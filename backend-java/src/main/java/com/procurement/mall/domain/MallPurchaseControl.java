package com.procurement.mall.domain;

import java.math.BigDecimal;
import java.util.List;

public record MallPurchaseControl(BigDecimal maxCheckoutAmount, List<String> categoryIds, boolean requireAddress) {
  public MallPurchaseControl {
    categoryIds = categoryIds == null ? List.of() : List.copyOf(categoryIds);
    if (maxCheckoutAmount != null && (maxCheckoutAmount.signum() <= 0 || maxCheckoutAmount.scale() > 2)) {
      throw new IllegalArgumentException("采购限额须大于0，最多两位小数");
    }
    if (categoryIds.size() > 100 || categoryIds.stream().anyMatch(x -> x == null || x.isBlank())) {
      throw new IllegalArgumentException("采购分类配置无效");
    }
  }
  public static MallPurchaseControl unrestricted() { return new MallPurchaseControl(null, List.of(), false); }
  public void check(BigDecimal amount, List<String> categories, boolean hasAddress) {
    if (amount == null || amount.signum() <= 0) throw new IllegalArgumentException("采购金额必须大于0");
    if (maxCheckoutAmount != null && amount.compareTo(maxCheckoutAmount) > 0) {
      throw new IllegalStateException("本次结算合计超过企业直采限额，请调整清单或通过采购需求及寻源流程办理");
    }
    if (!categoryIds.isEmpty() && categories.stream().anyMatch(x -> x == null || !categoryIds.contains(x))) {
      throw new IllegalStateException("清单含不在企业允许采购分类中的商品");
    }
    if (requireAddress && !hasAddress) throw new IllegalStateException("本企业要求选择有效的企业收货地址");
  }
}
