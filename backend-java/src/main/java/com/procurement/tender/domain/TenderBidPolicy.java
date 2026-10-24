package com.procurement.tender.domain;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

/**
 * 投标递交规则(C-2):
 * - 递交/撤回窗口:招标文件发售中 且 当前时间早于投标递交截止;
 * - 递交资格:已领取招标文件(acquired_at 非空);
 * - 报价须为正数,投标函正文非空;撤回后可在窗口内重投(覆盖为新密封)。
 */
public final class TenderBidPolicy {

  public static final String SEALED = "已密封";
  public static final String WITHDRAWN = "已撤回";

  private TenderBidPolicy() {}

  public static void requireSubmissionWindow(Tender tender, OffsetDateTime now) {
    if (!TenderPolicy.STATUS_ON_SALE.equals(tender.status())) {
      throw new IllegalStateException("招标项目不在发售期,不能递交或撤回投标: " + tender.id());
    }
    if (tender.submissionDeadline() == null || !now.isBefore(tender.submissionDeadline())) {
      throw new IllegalStateException("投标递交已截止: " + tender.id());
    }
  }

  public static void requireAcquired(TenderAcquisition acquisition, String tenderId) {
    if (acquisition == null || acquisition.acquiredAt() == null) {
      throw new IllegalStateException("须先领取招标文件方可递交投标: " + tenderId);
    }
  }

  public static void requireValidBid(BigDecimal amount, String documentHtml, String tenderId) {
    if (amount == null || amount.signum() <= 0) {
      throw new IllegalArgumentException("投标报价须为正数: " + tenderId);
    }
    if (amount.stripTrailingZeros().scale() > 2 || amount.compareTo(new BigDecimal("10000000000000000")) >= 0) {
      throw new IllegalArgumentException("投标报价最多两位小数且不得超出金额存储范围: " + tenderId);
    }
    if (documentHtml == null || documentHtml.isBlank()) {
      throw new IllegalArgumentException("投标函正文不能为空: " + tenderId);
    }
  }

  public static void requireSealed(TenderBid bid, String tenderId) {
    if (bid == null || !SEALED.equals(bid.sealedStatus())) {
      throw new IllegalStateException("当前无密封在案的投标可撤回: " + tenderId);
    }
  }
}
