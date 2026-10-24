package com.procurement.tender.domain;

import java.time.OffsetDateTime;

/**
 * 招标筹备段业务规则(C-1):
 * - 仅「编制中」可编辑与发布;发布(发售)须备齐招标文件正文与三个时间节点,且时序合法
 *   (获取截止 ≤ 递交截止 ≤ 开标时间,均须晚于当前)。
 * - 邀请发放仅限邀请招标且发售中;公开领取仅限公开招标且发售中、获取截止前。
 */
public final class TenderPolicy {

  public static final String TYPE_OPEN = "公开招标";
  public static final String TYPE_INVITED = "邀请招标";
  public static final String STATUS_DRAFTING = "编制中";
  public static final String STATUS_ON_SALE = "发售中";
  public static final String STATUS_CLOSED = "已截止";
  public static final String STATUS_OPENED = "已开标";
  public static final String STATUS_EVALUATING = "评标中";
  public static final String STATUS_AWARDED = "已定标";
  public static final String STATUS_FAILED = "已流标";

  private TenderPolicy() {}

  public static void requireDrafting(String status, String tenderId) {
    if (!STATUS_DRAFTING.equals(status)) {
      throw new IllegalStateException("仅「编制中」的招标项目可执行本操作: " + tenderId);
    }
  }

  public static void requirePublishable(Tender tender, OffsetDateTime now) {
    requireDrafting(tender.status(), tender.id());
    if (tender.documentHtml() == null || tender.documentHtml().isBlank()) {
      throw new IllegalArgumentException("招标文件正文尚未编制,不能发布发售: " + tender.id());
    }
    if (tender.acquisitionDeadline() == null
        || tender.submissionDeadline() == null
        || tender.openingAt() == null) {
      throw new IllegalArgumentException("获取截止/递交截止/开标时间须全部设置后方可发布: " + tender.id());
    }
    if (!now.isBefore(tender.acquisitionDeadline())) {
      throw new IllegalArgumentException("文件获取截止时间须晚于当前时间: " + tender.id());
    }
    if (tender.submissionDeadline().isBefore(tender.acquisitionDeadline())
        || tender.openingAt().isBefore(tender.submissionDeadline())) {
      throw new IllegalArgumentException("时间节点须满足 获取截止 ≤ 递交截止 ≤ 开标时间: " + tender.id());
    }
  }

  public static void requireInvitedDistribution(Tender tender) {
    if (!TYPE_INVITED.equals(tender.tenderType())) {
      throw new IllegalStateException("仅邀请招标可定向发放招标文件: " + tender.id());
    }
    if (!STATUS_ON_SALE.equals(tender.status())) {
      throw new IllegalStateException("招标文件发售中方可发放: " + tender.id());
    }
  }

  // 定时开标:到达约定开标时间后方可执行,且仅发售中的招标可开标(幂等重开抛错)。
  public static void requireOpenable(Tender tender, OffsetDateTime now) {
    if (!STATUS_ON_SALE.equals(tender.status())) {
      throw new IllegalStateException("仅发售中的招标项目可执行开标: " + tender.id());
    }
    if (tender.openingAt() == null || now.isBefore(tender.openingAt())) {
      throw new IllegalStateException("尚未到达约定开标时间,不能提前开标: " + tender.id());
    }
  }

  // 定标(C-5):仅评标中可定标;定标对象须为已解封的有效投标;通知书正文必备。
  public static void requireAwardable(Tender tender, TenderBid bid, String noticeHtml) {
    if (!STATUS_EVALUATING.equals(tender.status())) {
      throw new IllegalStateException("仅「评标中」的招标项目可定标: " + tender.id());
    }
    if (bid == null || !"已开启".equals(bid.sealedStatus())) {
      throw new IllegalArgumentException("定标对象须为已解封的有效投标: " + tender.id());
    }
    if (noticeHtml == null || noticeHtml.isBlank()) {
      throw new IllegalArgumentException("中标通知书正文不能为空: " + tender.id());
    }
  }

  // 转执行(C-7):仅已定标且尚未生成执行订单的招标项目可一键生成采购订单(幂等)。
  public static void requireExecutable(Tender tender) {
    if (!STATUS_AWARDED.equals(tender.status())) {
      throw new IllegalStateException("仅已定标的招标项目可生成执行订单: " + tender.id());
    }
    if (tender.executionOrderId() != null) {
      throw new IllegalStateException("执行订单已生成,不可重复生成: " + tender.executionOrderId());
    }
  }

  // 流标(C-6):开标后、定标前可宣布流标(无有效投标或评审全部不合格等),原因必填留痕。
  public static void requireFailable(Tender tender, String reason) {
    if (!STATUS_OPENED.equals(tender.status()) && !STATUS_EVALUATING.equals(tender.status())) {
      throw new IllegalStateException("仅开标后、定标前的招标项目可宣布流标: " + tender.id());
    }
    if (reason == null || reason.isBlank()) {
      throw new IllegalArgumentException("流标原因不能为空(留痕要求): " + tender.id());
    }
  }

  // 重新招标:仅已流标项目可发起;复制标的要素与正文,新草稿时间节点须重新设定。
  public static void requireRebiddable(Tender tender) {
    if (!STATUS_FAILED.equals(tender.status())) {
      throw new IllegalStateException("仅已流标的招标项目可重新招标: " + tender.id());
    }
  }

  public static void requireOpenAcquirable(Tender tender, OffsetDateTime now) {
    if (!TYPE_OPEN.equals(tender.tenderType())) {
      throw new IllegalStateException("邀请招标的文件由招标人定向发放,不可自助领取: " + tender.id());
    }
    requireAcquisitionWindow(tender, now);
  }

  public static void requireAcquisitionWindow(Tender tender, OffsetDateTime now) {
    if (!STATUS_ON_SALE.equals(tender.status())) {
      throw new IllegalStateException("招标文件不在发售期: " + tender.id());
    }
    if (tender.acquisitionDeadline() == null || !now.isBefore(tender.acquisitionDeadline())) {
      throw new IllegalStateException("文件获取已截止: " + tender.id());
    }
  }
}
