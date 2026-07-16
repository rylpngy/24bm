package com.procurement.tender.domain;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * 评标段业务规则(C-4):
 * - 仅「已开标」可组建评标委员会;委员会须 ≥3 人且为单数,姓名非空且不重复;
 *   已有评分后不可再改组委员会(评分留痕不可被换人抹除)。
 * - 仅「评标中」可提交评分;技术分/商务分均为 0~100;仅对「已开启」的有效投标评分。
 */
public final class TenderEvaluationPolicy {

  public static final String ROLE_LEADER = "组长";
  public static final String ROLE_MEMBER = "成员";
  private static final BigDecimal MAX_SCORE = BigDecimal.valueOf(100);

  private TenderEvaluationPolicy() {}

  public static void requireCommitteeFormable(Tender tender, List<String> memberNames, boolean hasScores) {
    if (!TenderPolicy.STATUS_OPENED.equals(tender.status())
        && !TenderPolicy.STATUS_EVALUATING.equals(tender.status())) {
      throw new IllegalStateException("仅开标后可组建评标委员会: " + tender.id());
    }
    if (hasScores) {
      throw new IllegalStateException("已有评分留痕,评标委员会不可再调整: " + tender.id());
    }
    if (memberNames == null || memberNames.size() < 3 || memberNames.size() % 2 == 0) {
      throw new IllegalArgumentException("评标委员会须 3 人及以上且为单数: " + tender.id());
    }
    Set<String> seen = new HashSet<>();
    for (String name : memberNames) {
      if (name == null || name.isBlank()) {
        throw new IllegalArgumentException("评委姓名不能为空: " + tender.id());
      }
      if (!seen.add(name.trim())) {
        throw new IllegalArgumentException("评委姓名重复: " + name.trim());
      }
    }
  }

  public static void requireScorable(Tender tender, TenderBid bid) {
    if (!TenderPolicy.STATUS_EVALUATING.equals(tender.status())) {
      throw new IllegalStateException("仅「评标中」的招标项目可提交评分: " + tender.id());
    }
    if (bid == null || !"已开启".equals(bid.sealedStatus())) {
      throw new IllegalArgumentException("仅可对已解封的有效投标评分: " + tender.id());
    }
  }

  public static void requireValidScore(BigDecimal technical, BigDecimal commercial, String bidId) {
    requireRange(technical, "技术分", bidId);
    requireRange(commercial, "商务分", bidId);
  }

  private static void requireRange(BigDecimal score, String label, String bidId) {
    if (score == null || score.signum() < 0 || score.compareTo(MAX_SCORE) > 0) {
      throw new IllegalArgumentException(label + "须在 0~100 之间: " + bidId);
    }
  }
}
