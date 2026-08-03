package com.procurement.mall.domain;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;

/**
 * 商城下单规则(M-1):起订量、步进量、阶梯价、库存、交期。
 *
 * <p>价格与数量一律服务端重算重校验——**不信任前端传来的单价**,否则购物车里改个数字就能改成交价。
 */
public final class MallCatalogPolicy {

  public static final String STATUS_DRAFT = "草稿";
  public static final String STATUS_PENDING = "待审核";
  public static final String STATUS_ON_SHELF = "在架";
  public static final String STATUS_OFF_SHELF = "下架";

  private MallCatalogPolicy() {}

  /** 结算数量适用的单价:取满足 minQty ≤ 数量 的最高档位,无匹配档位则用基础价。 */
  public static BigDecimal effectivePrice(MallSku sku, List<MallTierPrice> tiers, BigDecimal quantity) {
    if (tiers == null || tiers.isEmpty()) {
      return sku.price();
    }
    return tiers.stream()
        .filter(t -> t.minQty().compareTo(quantity) <= 0)
        .max(Comparator.comparing(MallTierPrice::minQty))
        .map(MallTierPrice::price)
        .orElse(sku.price());
  }

  /** 加购与结算共用的可售校验。 */
  public static void requireOrderable(MallProduct product, MallSku sku, BigDecimal quantity) {
    if (product == null || sku == null) {
      throw new IllegalArgumentException("商品或规格不存在,请刷新商城页面");
    }
    if (!STATUS_ON_SHELF.equals(product.status())) {
      throw new IllegalStateException("商品「" + product.name() + "」已" + product.status() + ",不可下单");
    }
    if (!STATUS_ON_SHELF.equals(sku.status())) {
      throw new IllegalStateException("该规格已下架,请选择其他规格");
    }
    if (quantity == null || quantity.signum() <= 0) {
      throw new IllegalArgumentException("下单数量必须大于 0");
    }
    if (quantity.compareTo(sku.minOrderQty()) < 0) {
      throw new IllegalStateException(
          "低于起订量:本规格起订 " + trim(sku.minOrderQty()) + sku.unit());
    }
    requireOnStep(sku, quantity);
    if (sku.stockQty() != null && quantity.compareTo(sku.stockQty()) > 0) {
      throw new IllegalStateException(
          "库存不足:仅剩 " + trim(sku.stockQty()) + sku.unit());
    }
  }

  private static void requireOnStep(MallSku sku, BigDecimal quantity) {
    BigDecimal step = sku.stepQty();
    if (step == null || step.signum() <= 0) {
      return;
    }
    BigDecimal delta = quantity.subtract(sku.minOrderQty());
    if (delta.remainder(step).signum() != 0) {
      throw new IllegalStateException(
          "数量需按 " + trim(step) + sku.unit() + " 的整数倍递增(起订 "
              + trim(sku.minOrderQty()) + sku.unit() + ")");
    }
  }

  /** 上架校验:价格为正、起订量与步进为正、交期非负。 */
  public static void requireValidSku(BigDecimal price, BigDecimal minOrderQty, BigDecimal stepQty,
      Integer leadTimeDays) {
    if (price == null || price.signum() <= 0) {
      throw new IllegalArgumentException("协议单价必须大于 0");
    }
    if (minOrderQty == null || minOrderQty.signum() <= 0) {
      throw new IllegalArgumentException("起订量必须大于 0");
    }
    if (stepQty == null || stepQty.signum() <= 0) {
      throw new IllegalArgumentException("递增步长必须大于 0");
    }
    if (leadTimeDays == null || leadTimeDays < 0) {
      throw new IllegalArgumentException("交期天数不能为负");
    }
  }

  /** 阶梯价校验:档位数量与单价为正,且单价随数量递减(否则阶梯没有意义)。 */
  public static void requireValidTiers(BigDecimal basePrice, List<MallTierPrice> tiers) {
    if (tiers == null || tiers.isEmpty()) {
      return;
    }
    List<MallTierPrice> sorted = tiers.stream()
        .sorted(Comparator.comparing(MallTierPrice::minQty))
        .toList();
    BigDecimal previous = basePrice;
    for (MallTierPrice tier : sorted) {
      if (tier.minQty() == null || tier.minQty().signum() <= 0) {
        throw new IllegalArgumentException("阶梯档位的起订数量必须大于 0");
      }
      if (tier.price() == null || tier.price().signum() <= 0) {
        throw new IllegalArgumentException("阶梯档位的单价必须大于 0");
      }
      if (tier.price().compareTo(previous) > 0) {
        throw new IllegalArgumentException(
            "阶梯价需随数量递减:" + trim(tier.minQty()) + " 档的单价高于上一档");
      }
      previous = tier.price();
    }
  }

  /** 商品状态流转:草稿/待审核/在架/下架四态,只允许注册过的目标状态。 */
  public static void requireValidStatus(String status) {
    if (!STATUS_DRAFT.equals(status) && !STATUS_PENDING.equals(status)
        && !STATUS_ON_SHELF.equals(status) && !STATUS_OFF_SHELF.equals(status)) {
      throw new IllegalArgumentException("非法的商品状态: " + status);
    }
  }

  private static String trim(BigDecimal value) {
    return value.stripTrailingZeros().toPlainString();
  }
}
