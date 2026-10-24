package com.procurement;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.procurement.mall.domain.MallAfterSalesPolicy;
import com.procurement.mall.domain.MallCatalogPolicy;
import com.procurement.mall.domain.MallProduct;
import java.math.BigDecimal;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** M-4 上架审核 / 售后 / 评价规则。 */
class MallAfterSalesPolicyTests {

  private static MallProduct product(String status) {
    return new MallProduct(
        "mp-1", "tenant", "tenant-acme", "sup-1", "晨光科技", null, null,
        "A4 复印纸", "晨光", "", null, status, null, null);
  }

  @Test
  @DisplayName("供应商不能自己上架:只能提审或下架")
  void supplierCannotSelfPublish() {
    assertThatThrownBy(() -> MallCatalogPolicy.requireSupplierTransition("草稿", "在架"))
        .hasMessageContaining("需由采购方审核");
    assertThatCode(() -> MallCatalogPolicy.requireSupplierTransition("草稿", "待审核"))
        .doesNotThrowAnyException();
    assertThatCode(() -> MallCatalogPolicy.requireSupplierTransition("在架", "下架"))
        .doesNotThrowAnyException();
    // 已在审核队列里的商品不能重复提审。
    assertThatThrownBy(() -> MallCatalogPolicy.requireSupplierTransition("待审核", "待审核"))
        .hasMessageContaining("不可提交审核");
  }

  @Test
  @DisplayName("审核:仅待审核可审,结论与意见都必填")
  void reviewGuards() {
    assertThatThrownBy(() -> MallCatalogPolicy.requireReviewable(product("在架"), true, "同意"))
        .hasMessageContaining("仅「待审核」");
    assertThatThrownBy(() -> MallCatalogPolicy.requireReviewable(product("待审核"), null, "同意"))
        .hasMessageContaining("审核结论");
    assertThatThrownBy(() -> MallCatalogPolicy.requireReviewable(product("待审核"), false, " "))
        .hasMessageContaining("审核意见");
    assertThatThrownBy(() -> MallCatalogPolicy.requireReviewable(null, true, "同意"))
        .hasMessageContaining("商品不存在");
    assertThatCode(() -> MallCatalogPolicy.requireReviewable(product("待审核"), true, "资质齐全"))
        .doesNotThrowAnyException();
  }

  @Test
  @DisplayName("售后:发货后才可申请,类型与原因受限")
  void afterSalesGuards() {
    assertThatThrownBy(() -> MallAfterSalesPolicy.requireApplicable(
        "待供应商确认", "退货", BigDecimal.ONE, "少发")).hasMessageContaining("发货后");
    assertThatThrownBy(() -> MallAfterSalesPolicy.requireApplicable(
        "已发货", "退款", BigDecimal.ONE, "少发")).hasMessageContaining("退货 / 换货 / 维修");
    assertThatThrownBy(() -> MallAfterSalesPolicy.requireApplicable(
        "已发货", "退货", BigDecimal.ZERO, "少发")).hasMessageContaining("数量");
    assertThatThrownBy(() -> MallAfterSalesPolicy.requireApplicable(
        "已发货", "退货", BigDecimal.ONE, " ")).hasMessageContaining("原因");
    assertThatCode(() -> MallAfterSalesPolicy.requireApplicable(
        "已收货", "换货", BigDecimal.ONE, "破损")).doesNotThrowAnyException();
  }

  @Test
  @DisplayName("售后数量不得超过该行订购数量")
  void afterSalesQuantityBounded() {
    assertThatThrownBy(() -> MallAfterSalesPolicy.requireWithinOrderedQuantity(
        new BigDecimal("5"), new BigDecimal("6"))).hasMessageContaining("超过订购数量");
    assertThatCode(() -> MallAfterSalesPolicy.requireWithinOrderedQuantity(
        new BigDecimal("5"), new BigDecimal("5"))).doesNotThrowAnyException();
  }

  @Test
  @DisplayName("售后处理:已结束不可重复处理,拒绝须给理由")
  void handleGuards() {
    assertThatThrownBy(() -> MallAfterSalesPolicy.requireHandleable("已完成", "处理中", null))
        .hasMessageContaining("已结束");
    assertThatThrownBy(() -> MallAfterSalesPolicy.requireHandleable("待处理", "待处理", null))
        .hasMessageContaining("处理中 / 已完成 / 已拒绝");
    assertThatThrownBy(() -> MallAfterSalesPolicy.requireHandleable("待处理", "已拒绝", " "))
        .hasMessageContaining("理由");
    assertThatThrownBy(() -> MallAfterSalesPolicy.requireHandleable("待处理", "已完成", null))
        .isInstanceOf(IllegalStateException.class);
    assertThatThrownBy(() -> MallAfterSalesPolicy.requireHandleable("处理中", "已完成", " "))
        .hasMessageContaining("回复");
    assertThatCode(() -> MallAfterSalesPolicy.requireHandleable("处理中", "已完成", "已换新"))
        .doesNotThrowAnyException();
  }

  @Test
  void cumulativeQuantityIncludesAlreadyCompletedClaims() {
    assertThatThrownBy(() -> MallAfterSalesPolicy.requireCumulativeQuantity(
        new BigDecimal("5"), new BigDecimal("4"), new BigDecimal("2")))
        .hasMessageContaining("累计");
    assertThatCode(() -> MallAfterSalesPolicy.requireCumulativeQuantity(
        new BigDecimal("5"), new BigDecimal("4"), BigDecimal.ONE))
        .doesNotThrowAnyException();
    assertThatThrownBy(() -> MallAfterSalesPolicy.requireApplicable(
        "已收货", "退货", new BigDecimal("0.001"), "破损"))
        .hasMessageContaining("小数");
  }

  @Test
  void buyerMustConfirmAndCannotWithdrawCompletedWork() {
    assertThatThrownBy(() -> MallAfterSalesPolicy.requireBuyerAction("处理中", "confirm"))
        .isInstanceOf(IllegalStateException.class);
    assertThatCode(() -> MallAfterSalesPolicy.requireBuyerAction("待买方确认", "confirm"))
        .doesNotThrowAnyException();
    assertThatThrownBy(() -> MallAfterSalesPolicy.requireBuyerAction("待买方确认", "withdraw"))
        .isInstanceOf(IllegalStateException.class);
    assertThatThrownBy(() -> MallAfterSalesPolicy.requireHandleable("待买方确认", "已拒绝", "拒绝"))
        .isInstanceOf(IllegalStateException.class);
  }

  @Test
  @DisplayName("评价:收货后才可评,评分限 1-5 星")
  void reviewRules() {
    assertThatThrownBy(() -> MallAfterSalesPolicy.requireReviewable("已发货", 5))
        .hasMessageContaining("收货后");
    assertThatThrownBy(() -> MallAfterSalesPolicy.requireReviewable("已收货", 0))
        .hasMessageContaining("1-5");
    assertThatThrownBy(() -> MallAfterSalesPolicy.requireReviewable("已收货", 6))
        .hasMessageContaining("1-5");
    assertThatCode(() -> MallAfterSalesPolicy.requireReviewable("已收货", 5))
        .doesNotThrowAnyException();
  }
}
