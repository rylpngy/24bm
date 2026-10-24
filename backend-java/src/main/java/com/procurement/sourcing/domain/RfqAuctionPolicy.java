package com.procurement.sourcing.domain;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.OffsetDateTime;

// 竞价出价规则:首轮出价不得高于起拍价;有在场最低价时,新出价须至少比它低一个降价步长。
// 竞价时段复用 RFQ 报价截止(deadline_at)守卫,此处只管价格竞争规则。
public final class RfqAuctionPolicy {

  // 软关闭(防狙击):截止前 5 分钟内的有效出价,自动把截止时间顺延 5 分钟,给对手回应窗口。
  public static final Duration SOFT_CLOSE_WINDOW = Duration.ofMinutes(5);
  public static final Duration SOFT_CLOSE_EXTENSION = Duration.ofMinutes(5);

  private RfqAuctionPolicy() {}

  /** 软关闭:出价落在截止窗口内时返回顺延后的新截止时间,否则返回 null(不顺延)。 */
  public static OffsetDateTime extendedDeadline(OffsetDateTime deadlineAt, OffsetDateTime now) {
    return extendedDeadline(deadlineAt, now, null, null);
  }

  /** 软关闭(可配置):triggerMinutes/extendMinutes 为空时用默认 5/5;<=0 视为关闭自动延时。 */
  public static OffsetDateTime extendedDeadline(
      OffsetDateTime deadlineAt, OffsetDateTime now, Integer triggerMinutes, Integer extendMinutes) {
    if (deadlineAt == null || now == null || now.isAfter(deadlineAt)) {
      return null;
    }
    Duration window = triggerMinutes == null ? SOFT_CLOSE_WINDOW : Duration.ofMinutes(triggerMinutes);
    Duration extension = extendMinutes == null ? SOFT_CLOSE_EXTENSION : Duration.ofMinutes(extendMinutes);
    if (window.isZero() || window.isNegative() || extension.isZero() || extension.isNegative()) {
      return null;
    }
    if (Duration.between(now, deadlineAt).compareTo(window) > 0) {
      return null;
    }
    OffsetDateTime extended = now.plus(extension);
    return extended.isAfter(deadlineAt) ? extended : null;
  }

  public static boolean isAuction(String method) {
    return RfqMethod.AUCTION.equals(RfqMethod.orDefault(method));
  }

  public static void requireValidSchedule(String method, OffsetDateTime start, OffsetDateTime deadline) {
    if (isAuction(method) && start != null && (deadline == null || !start.isBefore(deadline))) {
      throw new IllegalArgumentException("竞价开始时间必须早于截止时间");
    }
  }

  public static void requireStarted(String method, OffsetDateTime start, OffsetDateTime now) {
    if (isAuction(method) && start != null && now.isBefore(start)) {
      throw new IllegalStateException("竞价尚未到计划开始时间");
    }
  }

  // 创建竞价项目时的参数校验:起拍价必填且为正;步长可缺省(默认 0,即只须低于当前最低价)。
  public static void requireValidParams(String method, BigDecimal startPrice, BigDecimal minDecrement) {
    if (!isAuction(method)) {
      if (startPrice != null || minDecrement != null) {
        throw new IllegalArgumentException("仅竞价方式可设置起拍价/降价步长");
      }
      return;
    }
    if (startPrice == null || startPrice.signum() <= 0) {
      throw new IllegalArgumentException("竞价项目必须设置正数起拍价");
    }
    if (minDecrement != null && minDecrement.signum() < 0) {
      throw new IllegalArgumentException("竞价降价步长不能为负数");
    }
  }

  // 供应商出价校验:amount 为本次报价总额,currentLowest 为当前轮已提交的最低报价(可为 null)。
  public static void requireValidBid(
      String method,
      BigDecimal startPrice,
      BigDecimal minDecrement,
      BigDecimal currentLowest,
      BigDecimal amount,
      String rfqId) {
    if (!isAuction(method)) {
      return;
    }
    if (amount == null || amount.signum() <= 0) {
      throw new IllegalArgumentException("竞价报价必须填写正数金额: " + rfqId);
    }
    if (startPrice != null && amount.compareTo(startPrice) > 0) {
      throw new IllegalStateException(
          "竞价出价不得高于起拍价 " + startPrice.toPlainString() + ": " + rfqId);
    }
    if (currentLowest == null) {
      return;
    }
    BigDecimal decrement = minDecrement == null ? BigDecimal.ZERO : minDecrement;
    BigDecimal ceiling = currentLowest.subtract(decrement);
    if (amount.compareTo(currentLowest) >= 0 || amount.compareTo(ceiling) > 0) {
      throw new IllegalStateException(
          "竞价出价须比当前最低价 " + currentLowest.toPlainString()
              + " 至少再降 " + decrement.toPlainString() + ": " + rfqId);
    }
  }
}
