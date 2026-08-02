package com.procurement.tender.domain;

/**
 * 招标资格预审规则(F-1):
 * - 开关仅「编制中」可设定(发布后不得变更资格门槛,保公平);
 * - 申请仅在「发售中」且资格获取截止前提交;已通过者不重复申请,驳回后可重新申请;
 * - 审查仅「发售中」进行,结论限 已通过 / 未通过 且须给出意见;
 * - 已开启预审的项目,**未通过预审不得领取招标文件**(投标以已领取为前提,门槛自动继承)。
 */
public final class TenderPrequalificationPolicy {

  public static final String STATUS_PENDING = "待审查";
  public static final String STATUS_PASSED = "已通过";
  public static final String STATUS_REJECTED = "未通过";

  private TenderPrequalificationPolicy() {}

  public static void requireToggleable(Tender tender) {
    if (!TenderPolicy.STATUS_DRAFTING.equals(tender.status())) {
      throw new IllegalStateException("资格预审要求仅「编制中」可设定,发布后不得变更: " + tender.id());
    }
  }

  public static void requireApplicable(Tender tender, TenderPrequalification existing, String application) {
    if (!tender.prequalificationRequired()) {
      throw new IllegalStateException("本项目未开启资格预审,可直接领取招标文件: " + tender.id());
    }
    if (!TenderPolicy.STATUS_ON_SALE.equals(tender.status())) {
      throw new IllegalStateException("仅发售中的招标项目可提交资格预审申请: " + tender.id());
    }
    if (existing != null && STATUS_PASSED.equals(existing.status())) {
      throw new IllegalStateException("资格预审已通过,无需重复申请: " + tender.id());
    }
    if (existing != null && STATUS_PENDING.equals(existing.status())) {
      throw new IllegalStateException("资格预审申请审查中,请等待结果: " + tender.id());
    }
    if (application == null || application.isBlank()) {
      throw new IllegalArgumentException("资格声明不能为空(请说明资质、业绩与履约能力)");
    }
  }

  public static void requireReviewable(
      Tender tender, TenderPrequalification application, String status, String comment) {
    if (!TenderPolicy.STATUS_ON_SALE.equals(tender.status())) {
      throw new IllegalStateException("仅发售中的招标项目可审查资格预审: " + tender.id());
    }
    if (application == null) {
      throw new IllegalArgumentException("资格预审申请不存在");
    }
    if (!STATUS_PENDING.equals(application.status())) {
      throw new IllegalStateException("该申请已审查,结论为: " + application.status());
    }
    if (!STATUS_PASSED.equals(status) && !STATUS_REJECTED.equals(status)) {
      throw new IllegalArgumentException("审查结论须为 已通过 或 未通过: " + status);
    }
    if (comment == null || comment.isBlank()) {
      throw new IllegalArgumentException("审查意见不能为空(留痕要求)");
    }
  }

  /** 领取门槛:开启预审的项目须预审通过。 */
  public static void requirePrequalified(Tender tender, TenderPrequalification mine) {
    if (!tender.prequalificationRequired()) {
      return;
    }
    if (mine == null) {
      throw new IllegalStateException("本项目实行资格预审,请先提交资格预审申请: " + tender.id());
    }
    if (!STATUS_PASSED.equals(mine.status())) {
      throw new IllegalStateException("资格预审" + mine.status() + ",暂不可领取招标文件: " + tender.id());
    }
  }
}
