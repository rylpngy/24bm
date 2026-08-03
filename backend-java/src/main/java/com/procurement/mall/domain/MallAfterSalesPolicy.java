package com.procurement.mall.domain;

import java.math.BigDecimal;
import java.util.Set;

/**
 * 售后与评价规则(M-4)。
 *
 * <p>售后与评价都以「货已到」为前提:没收到货就退换或打分没有业务意义,
 * 也容易被用来刷分。前置状态判断放在这里,应用层只负责取数据。
 */
public final class MallAfterSalesPolicy {

  public static final String TYPE_RETURN = "退货";
  public static final String TYPE_EXCHANGE = "换货";
  public static final String TYPE_REPAIR = "维修";

  public static final String STATUS_PENDING = "待处理";
  public static final String STATUS_PROCESSING = "处理中";
  public static final String STATUS_DONE = "已完成";
  public static final String STATUS_REJECTED = "已拒绝";

  private static final Set<String> TYPES = Set.of(TYPE_RETURN, TYPE_EXCHANGE, TYPE_REPAIR);
  private static final Set<String> SUPPLIER_TARGET_STATUSES =
      Set.of(STATUS_PROCESSING, STATUS_DONE, STATUS_REJECTED);

  /** 允许申请售后/评价的订单状态:已发货起可申请售后,已收货后可评价。 */
  private static final Set<String> AFTER_SALES_ORDER_STATUSES = Set.of("已发货", "已收货");
  private static final String RECEIVED = "已收货";

  private MallAfterSalesPolicy() {}

  public static void requireApplicable(
      String orderStatus, String type, BigDecimal quantity, String reason) {
    if (!AFTER_SALES_ORDER_STATUSES.contains(orderStatus)) {
      throw new IllegalStateException(
          "订单当前为「" + orderStatus + "」,发货后才能申请售后");
    }
    if (!TYPES.contains(type)) {
      throw new IllegalArgumentException("售后类型须为 退货 / 换货 / 维修: " + type);
    }
    if (quantity == null || quantity.signum() <= 0) {
      throw new IllegalArgumentException("售后数量必须大于 0");
    }
    if (reason == null || reason.isBlank()) {
      throw new IllegalArgumentException("请填写售后原因(供应商据此判断处理方式)");
    }
  }

  /** 售后数量不得超过该订单行的订购数量。 */
  public static void requireWithinOrderedQuantity(BigDecimal ordered, BigDecimal requested) {
    if (ordered != null && requested.compareTo(ordered) > 0) {
      throw new IllegalStateException(
          "售后数量超过订购数量:本行共 " + ordered.stripTrailingZeros().toPlainString());
    }
  }

  public static void requireHandleable(String currentStatus, String targetStatus, String reply) {
    if (STATUS_DONE.equals(currentStatus) || STATUS_REJECTED.equals(currentStatus)) {
      throw new IllegalStateException("该售后单已结束(" + currentStatus + "),不可重复处理");
    }
    if (!SUPPLIER_TARGET_STATUSES.contains(targetStatus)) {
      throw new IllegalArgumentException("处理结论须为 处理中 / 已完成 / 已拒绝: " + targetStatus);
    }
    if (STATUS_REJECTED.equals(targetStatus) && (reply == null || reply.isBlank())) {
      throw new IllegalArgumentException("拒绝售后必须说明理由");
    }
  }

  public static void requireReviewable(String orderStatus, int rating) {
    if (!RECEIVED.equals(orderStatus)) {
      throw new IllegalStateException("订单收货后才能评价(当前为「" + orderStatus + "」)");
    }
    if (rating < 1 || rating > 5) {
      throw new IllegalArgumentException("评分须为 1-5 星: " + rating);
    }
  }
}
