package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.procurement.mall.domain.MallCatalogPolicy;
import com.procurement.mall.domain.MallProduct;
import com.procurement.mall.domain.MallSku;
import com.procurement.mall.domain.MallTierPrice;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** M-1 商城下单规则:起订量、步进、库存、阶梯价、上架校验。 */
class MallCatalogPolicyTests {

  private static MallProduct product(String status) {
    return new MallProduct(
        "mp-1", "tenant", "tenant-acme", "sup-1", "晨光科技", "mc-1", "办公设备",
        "A4 复印纸", "晨光", "", null, status, null, null);
  }

  private static MallSku sku(BigDecimal minOrderQty, BigDecimal stepQty, BigDecimal stockQty) {
    return new MallSku(
        "ms-1", "mp-1", "A4-80", "{}", "mat-1", "箱", new BigDecimal("168"),
        minOrderQty, stepQty, stockQty, 3, "在架", null, null);
  }

  private static final List<MallTierPrice> TIERS = List.of(
      new MallTierPrice("ms-1", new BigDecimal("10"), new BigDecimal("158")),
      new MallTierPrice("ms-1", new BigDecimal("50"), new BigDecimal("148")));

  @Test
  @DisplayName("阶梯价按结算数量落档,未达首档用基础价")
  void tierPricing() {
    MallSku sku = sku(BigDecimal.ONE, BigDecimal.ONE, null);
    assertThat(MallCatalogPolicy.effectivePrice(sku, TIERS, new BigDecimal("9")))
        .isEqualByComparingTo("168");
    assertThat(MallCatalogPolicy.effectivePrice(sku, TIERS, new BigDecimal("10")))
        .isEqualByComparingTo("158");
    assertThat(MallCatalogPolicy.effectivePrice(sku, TIERS, new BigDecimal("49")))
        .isEqualByComparingTo("158");
    assertThat(MallCatalogPolicy.effectivePrice(sku, TIERS, new BigDecimal("50")))
        .isEqualByComparingTo("148");
    assertThat(MallCatalogPolicy.effectivePrice(sku, List.of(), new BigDecimal("100")))
        .isEqualByComparingTo("168");
  }

  @Test
  @DisplayName("起订量与步进:低于起订、不合步进均拒绝")
  void minOrderAndStep() {
    MallSku sku = sku(new BigDecimal("2"), new BigDecimal("2"), null);
    assertThatThrownBy(() ->
        MallCatalogPolicy.requireOrderable(product("在架"), sku, BigDecimal.ONE))
        .hasMessageContaining("起订");
    assertThatThrownBy(() ->
        MallCatalogPolicy.requireOrderable(product("在架"), sku, new BigDecimal("3")))
        .hasMessageContaining("整数倍");
    assertThatCode(() ->
        MallCatalogPolicy.requireOrderable(product("在架"), sku, new BigDecimal("4")))
        .doesNotThrowAnyException();
  }

  @Test
  @DisplayName("库存:为空表示不限量;非空则不得超卖")
  void stockGuard() {
    assertThatCode(() -> MallCatalogPolicy.requireOrderable(
        product("在架"), sku(BigDecimal.ONE, BigDecimal.ONE, null), new BigDecimal("9999")))
        .doesNotThrowAnyException();
    assertThatThrownBy(() -> MallCatalogPolicy.requireOrderable(
        product("在架"), sku(BigDecimal.ONE, BigDecimal.ONE, new BigDecimal("5")),
        new BigDecimal("6")))
        .hasMessageContaining("库存不足");
  }

  @Test
  @DisplayName("下架商品不可下单,规格下架同样拦截")
  void offShelfBlocked() {
    MallSku onShelf = sku(BigDecimal.ONE, BigDecimal.ONE, null);
    assertThatThrownBy(() ->
        MallCatalogPolicy.requireOrderable(product("下架"), onShelf, BigDecimal.ONE))
        .hasMessageContaining("下架");

    MallSku offShelfSku = new MallSku(
        "ms-1", "mp-1", "A4-80", "{}", "mat-1", "箱", new BigDecimal("168"),
        BigDecimal.ONE, BigDecimal.ONE, null, 3, "下架", null, null);
    assertThatThrownBy(() ->
        MallCatalogPolicy.requireOrderable(product("在架"), offShelfSku, BigDecimal.ONE))
        .hasMessageContaining("规格已下架");
  }

  @Test
  @DisplayName("阶梯价必须随数量递减,否则阶梯没有意义")
  void tiersMustDecrease() {
    assertThatThrownBy(() -> MallCatalogPolicy.requireValidTiers(
        new BigDecimal("100"),
        List.of(new MallTierPrice("ms-1", new BigDecimal("10"), new BigDecimal("120")))))
        .hasMessageContaining("递减");
    assertThatCode(() -> MallCatalogPolicy.requireValidTiers(new BigDecimal("168"), TIERS))
        .doesNotThrowAnyException();
  }

  @Test
  @DisplayName("上架校验:价格/起订量/步进为正,交期非负")
  void skuValidation() {
    assertThatThrownBy(() -> MallCatalogPolicy.requireValidSku(
        BigDecimal.ZERO, BigDecimal.ONE, BigDecimal.ONE, 7)).hasMessageContaining("单价");
    assertThatThrownBy(() -> MallCatalogPolicy.requireValidSku(
        BigDecimal.TEN, BigDecimal.ZERO, BigDecimal.ONE, 7)).hasMessageContaining("起订量");
    assertThatThrownBy(() -> MallCatalogPolicy.requireValidSku(
        BigDecimal.TEN, BigDecimal.ONE, BigDecimal.ZERO, 7)).hasMessageContaining("步长");
    assertThatThrownBy(() -> MallCatalogPolicy.requireValidSku(
        BigDecimal.TEN, BigDecimal.ONE, BigDecimal.ONE, -1)).hasMessageContaining("交期");
    assertThatCode(() -> MallCatalogPolicy.requireValidSku(
        BigDecimal.TEN, BigDecimal.ONE, BigDecimal.ONE, 0)).doesNotThrowAnyException();
  }
}
