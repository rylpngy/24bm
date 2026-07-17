package com.procurement.tender.domain;

import java.math.BigDecimal;

/**
 * 评标问询与二次报价规则(C-9):
 * - 仅「评标中」可发起,且仅面向已解封的有效投标;类别限 澄清问询 / 二次报价。
 * - 每条问询仅可答复一次;二次报价答复须给出正数修订报价,澄清问询不得改价。
 * - 修订报价不改动密封投标原件(指纹链不破),评标价格分按最新有效报价计算。
 */
public final class TenderInquiryPolicy {

  public static final String KIND_CLARIFY = "澄清问询";
  public static final String KIND_REQUOTE = "二次报价";

  private TenderInquiryPolicy() {}

  public static void requireInquiryOpen(Tender tender, TenderBid bid, String kind) {
    if (!TenderPolicy.STATUS_EVALUATING.equals(tender.status())) {
      throw new IllegalStateException("仅「评标中」的招标项目可发起问询: " + tender.id());
    }
    if (bid == null || !"已开启".equals(bid.sealedStatus())) {
      throw new IllegalArgumentException("仅可向已解封的有效投标发起问询: " + tender.id());
    }
    if (!KIND_CLARIFY.equals(kind) && !KIND_REQUOTE.equals(kind)) {
      throw new IllegalArgumentException("问询类别须为 澄清问询 或 二次报价: " + kind);
    }
  }

  public static void requireAnswerable(Tender tender, TenderInquiry inquiry) {
    if (!TenderPolicy.STATUS_EVALUATING.equals(tender.status())) {
      throw new IllegalStateException("评标已结束,问询不再受理答复: " + tender.id());
    }
    if (inquiry.answeredAt() != null) {
      throw new IllegalStateException("该问询已答复,不可重复提交: " + inquiry.id());
    }
  }

  public static void requireValidAnswer(String kind, String answer, BigDecimal revisedAmount) {
    if (answer == null || answer.isBlank()) {
      throw new IllegalArgumentException("答复内容不能为空");
    }
    if (KIND_REQUOTE.equals(kind)) {
      if (revisedAmount == null || revisedAmount.signum() <= 0) {
        throw new IllegalArgumentException("二次报价须给出正数修订报价");
      }
    } else if (revisedAmount != null) {
      throw new IllegalArgumentException("澄清问询不得修改报价");
    }
  }
}
