package com.procurement;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.procurement.tender.domain.Tender;
import com.procurement.tender.domain.TenderPolicy;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.Test;

// 招标筹备段规则:发布前置(正文+时间节点齐备且时序合法)、发放/领取窗口。
class TenderPolicyTests {

  private Tender tender(String type, String status, String doc,
      OffsetDateTime acq, OffsetDateTime sub, OffsetDateTime open) {
    return new Tender("tender-1", "tenant-1", "ZB20260716001", "测试招标", type,
        BigDecimal.valueOf(100000), status, doc, "综合评分法", null,
        acq, sub, open, "user-1", null, OffsetDateTime.now(), OffsetDateTime.now(), null, null, null, null, null, null, null, null, false);
  }

  @Test
  void publishRequiresDocumentAndOrderedDeadlines() {
    var now = OffsetDateTime.now();
    assertThatCode(() -> TenderPolicy.requirePublishable(
        tender("公开招标", "编制中", "<p>正文</p>", now.plusDays(2), now.plusDays(4), now.plusDays(5)), now))
        .doesNotThrowAnyException();

    assertThatThrownBy(() -> TenderPolicy.requirePublishable(
        tender("公开招标", "编制中", " ", now.plusDays(2), now.plusDays(4), now.plusDays(5)), now))
        .hasMessageContaining("正文尚未编制");

    assertThatThrownBy(() -> TenderPolicy.requirePublishable(
        tender("公开招标", "编制中", "<p>正文</p>", now.plusDays(4), now.plusDays(2), now.plusDays(5)), now))
        .hasMessageContaining("获取截止 ≤ 递交截止 ≤ 开标时间");

    assertThatThrownBy(() -> TenderPolicy.requirePublishable(
        tender("公开招标", "发售中", "<p>正文</p>", now.plusDays(2), now.plusDays(4), now.plusDays(5)), now))
        .hasMessageContaining("编制中");
  }

  @Test
  void distributionOnlyForInvitedTenderOnSale() {
    var now = OffsetDateTime.now();
    assertThatCode(() -> TenderPolicy.requireInvitedDistribution(
        tender("邀请招标", "发售中", "<p>x</p>", now, now, now)))
        .doesNotThrowAnyException();
    assertThatThrownBy(() -> TenderPolicy.requireInvitedDistribution(
        tender("公开招标", "发售中", "<p>x</p>", now, now, now)))
        .hasMessageContaining("仅邀请招标");
    assertThatThrownBy(() -> TenderPolicy.requireInvitedDistribution(
        tender("邀请招标", "编制中", "<p>x</p>", now, now, now)))
        .hasMessageContaining("发售中");
  }

  @Test
  void openAcquisitionRespectsTypeStatusAndDeadline() {
    var now = OffsetDateTime.now();
    assertThatCode(() -> TenderPolicy.requireOpenAcquirable(
        tender("公开招标", "发售中", "<p>x</p>", now.plusDays(1), now.plusDays(2), now.plusDays(3)), now))
        .doesNotThrowAnyException();
    assertThatThrownBy(() -> TenderPolicy.requireOpenAcquirable(
        tender("邀请招标", "发售中", "<p>x</p>", now.plusDays(1), now.plusDays(2), now.plusDays(3)), now))
        .hasMessageContaining("定向发放");
    assertThatThrownBy(() -> TenderPolicy.requireOpenAcquirable(
        tender("公开招标", "发售中", "<p>x</p>", now.minusHours(1), now.plusDays(2), now.plusDays(3)), now))
        .hasMessageContaining("已截止");
  }

  @Test
  void invitedAndOpenAcquisitionUseTheSameExclusiveDeadline() {
    var now = OffsetDateTime.now();
    assertThatThrownBy(() -> TenderPolicy.requireAcquisitionWindow(
        tender("邀请招标", "发售中", "doc", now, now.plusDays(1), now.plusDays(2)), now))
        .hasMessageContaining("已截止");
    assertThatThrownBy(() -> TenderPolicy.requireAcquisitionWindow(
        tender("公开招标", "发售中", "doc", null, now.plusDays(1), now.plusDays(2)), now))
        .hasMessageContaining("已截止");
    assertThatThrownBy(() -> TenderPolicy.requireAcquisitionWindow(
        tender("邀请招标", "已流标", "doc", now.plusDays(1), now.plusDays(2), now.plusDays(3)), now))
        .hasMessageContaining("不在发售期");
  }

  // ── C-3 定时开标 ─────────────────────────────────────────────
  @Test
  void openingOnlyAfterScheduledTimeAndWhileOnSale() {
    var now = OffsetDateTime.now();
    assertThatCode(() -> TenderPolicy.requireOpenable(
        tender("公开招标", "发售中", "<p>x</p>", now.minusDays(3), now.minusDays(1), now.minusHours(1)), now))
        .doesNotThrowAnyException();
    assertThatThrownBy(() -> TenderPolicy.requireOpenable(
        tender("公开招标", "发售中", "<p>x</p>", now.plusDays(1), now.plusDays(2), now.plusDays(3)), now))
        .hasMessageContaining("尚未到达约定开标时间");
    assertThatThrownBy(() -> TenderPolicy.requireOpenable(
        tender("公开招标", "已开标", "<p>x</p>", now.minusDays(3), now.minusDays(1), now.minusHours(1)), now))
        .hasMessageContaining("仅发售中");
  }

  // ── C-2 投标递交规则 ─────────────────────────────────────────
  @Test
  void bidSubmissionRequiresOnSaleWindowAndAcquisition() {
    var now = OffsetDateTime.now();
    var onSale = tender("公开招标", "发售中", "<p>x</p>", now.plusDays(1), now.plusDays(2), now.plusDays(3));
    assertThatCode(() -> com.procurement.tender.domain.TenderBidPolicy.requireSubmissionWindow(onSale, now))
        .doesNotThrowAnyException();
    assertThatThrownBy(() -> com.procurement.tender.domain.TenderBidPolicy.requireSubmissionWindow(
        tender("公开招标", "编制中", "<p>x</p>", now.plusDays(1), now.plusDays(2), now.plusDays(3)), now))
        .hasMessageContaining("不在发售期");
    assertThatThrownBy(() -> com.procurement.tender.domain.TenderBidPolicy.requireSubmissionWindow(
        tender("公开招标", "发售中", "<p>x</p>", now.minusDays(2), now.minusHours(1), now.plusDays(1)), now))
        .hasMessageContaining("已截止");

    assertThatThrownBy(() -> com.procurement.tender.domain.TenderBidPolicy.requireAcquired(null, "tender-1"))
        .hasMessageContaining("须先领取招标文件");
    assertThatThrownBy(() -> com.procurement.tender.domain.TenderBidPolicy.requireAcquired(
        new com.procurement.tender.domain.TenderAcquisition("a", "t", "tender-1", "s", "邀请发放", null, now), "tender-1"))
        .hasMessageContaining("须先领取招标文件");
    assertThatCode(() -> com.procurement.tender.domain.TenderBidPolicy.requireAcquired(
        new com.procurement.tender.domain.TenderAcquisition("a", "t", "tender-1", "s", "公开领取", now, now), "tender-1"))
        .doesNotThrowAnyException();
  }

  @Test
  void bidContentAndWithdrawGuards() {
    assertThatThrownBy(() -> com.procurement.tender.domain.TenderBidPolicy.requireValidBid(
        BigDecimal.ZERO, "<p>x</p>", "tender-1")).hasMessageContaining("正数");
    assertThatThrownBy(() -> com.procurement.tender.domain.TenderBidPolicy.requireValidBid(
        BigDecimal.ONE, " ", "tender-1")).hasMessageContaining("投标函正文");
    assertThatThrownBy(() -> com.procurement.tender.domain.TenderBidPolicy.requireSealed(null, "tender-1"))
        .hasMessageContaining("无密封在案");
  }

  // ── C-4 评标规则 ─────────────────────────────────────────────
  @Test
  void committeeRequiresOpenedTenderAndOddSizeAtLeastThree() {
    var now = OffsetDateTime.now();
    var opened = tender("公开招标", "已开标", "<p>x</p>", now.minusDays(3), now.minusDays(1), now.minusHours(2));
    assertThatCode(() -> com.procurement.tender.domain.TenderEvaluationPolicy.requireCommitteeFormable(
        opened, java.util.List.of("张三", "李四", "王五"), false)).doesNotThrowAnyException();
    assertThatThrownBy(() -> com.procurement.tender.domain.TenderEvaluationPolicy.requireCommitteeFormable(
        tender("公开招标", "发售中", "<p>x</p>", now, now, now), java.util.List.of("张三", "李四", "王五"), false))
        .hasMessageContaining("仅开标后");
    assertThatThrownBy(() -> com.procurement.tender.domain.TenderEvaluationPolicy.requireCommitteeFormable(
        opened, java.util.List.of("张三", "李四"), false)).hasMessageContaining("3 人及以上且为单数");
    assertThatThrownBy(() -> com.procurement.tender.domain.TenderEvaluationPolicy.requireCommitteeFormable(
        opened, java.util.List.of("张三", "李四", "王五", "赵六"), false)).hasMessageContaining("单数");
    assertThatThrownBy(() -> com.procurement.tender.domain.TenderEvaluationPolicy.requireCommitteeFormable(
        opened, java.util.List.of("张三", "张三", "王五"), false)).hasMessageContaining("重复");
    assertThatThrownBy(() -> com.procurement.tender.domain.TenderEvaluationPolicy.requireCommitteeFormable(
        opened, java.util.List.of("张三", "李四", "王五"), true)).hasMessageContaining("评分留痕");
  }

  @Test
  void scoringRequiresEvaluatingStatusUnsealedBidAndRange() {
    var now = OffsetDateTime.now();
    var evaluating = tender("公开招标", "评标中", "<p>x</p>", now.minusDays(3), now.minusDays(1), now.minusHours(2));
    var openedBid = new com.procurement.tender.domain.TenderBid(
        "tbid-1", "t", "tender-1", "s", BigDecimal.TEN, "<p>doc</p>", "digest", "已开启", now, null);
    assertThatCode(() -> com.procurement.tender.domain.TenderEvaluationPolicy.requireScorable(evaluating, openedBid))
        .doesNotThrowAnyException();
    assertThatThrownBy(() -> com.procurement.tender.domain.TenderEvaluationPolicy.requireScorable(
        tender("公开招标", "已开标", "<p>x</p>", now, now, now), openedBid))
        .hasMessageContaining("评标中");
    assertThatThrownBy(() -> com.procurement.tender.domain.TenderEvaluationPolicy.requireScorable(
        evaluating, new com.procurement.tender.domain.TenderBid(
            "tbid-2", "t", "tender-1", "s", BigDecimal.TEN, null, "digest", "已撤回", now, now)))
        .hasMessageContaining("已解封的有效投标");
    assertThatThrownBy(() -> com.procurement.tender.domain.TenderEvaluationPolicy.requireValidScore(
        BigDecimal.valueOf(101), BigDecimal.TEN, "tbid-1")).hasMessageContaining("技术分");
    assertThatThrownBy(() -> com.procurement.tender.domain.TenderEvaluationPolicy.requireValidScore(
        BigDecimal.TEN, BigDecimal.valueOf(-1), "tbid-1")).hasMessageContaining("商务分");
  }

  // ── C-5 定标规则 ─────────────────────────────────────────────
  @Test
  void awardOnlyDuringEvaluationForUnsealedBidWithNotice() {
    var now = OffsetDateTime.now();
    var evaluating = tender("公开招标", "评标中", "<p>x</p>", now.minusDays(3), now.minusDays(1), now.minusHours(2));
    var openedBid = new com.procurement.tender.domain.TenderBid(
        "tbid-1", "t", "tender-1", "s", BigDecimal.TEN, "<p>doc</p>", "digest", "已开启", now, null);
    assertThatCode(() -> TenderPolicy.requireAwardable(evaluating, openedBid, "<p>中标通知书</p>"))
        .doesNotThrowAnyException();
    assertThatThrownBy(() -> TenderPolicy.requireAwardable(
        tender("公开招标", "已开标", "<p>x</p>", now, now, now), openedBid, "<p>n</p>"))
        .hasMessageContaining("评标中");
    assertThatThrownBy(() -> TenderPolicy.requireAwardable(
        evaluating, new com.procurement.tender.domain.TenderBid(
            "tbid-2", "t", "tender-1", "s", BigDecimal.TEN, null, "digest", "已撤回", now, now), "<p>n</p>"))
        .hasMessageContaining("已解封的有效投标");
    assertThatThrownBy(() -> TenderPolicy.requireAwardable(evaluating, openedBid, " "))
        .hasMessageContaining("通知书正文");
  }

  // ── C-6 流标与重新招标 ───────────────────────────────────────
  @Test
  void failureOnlyAfterOpeningBeforeAwardWithReason() {
    var now = OffsetDateTime.now();
    assertThatCode(() -> TenderPolicy.requireFailable(
        tender("公开招标", "已开标", "<p>x</p>", now, now, now), "无有效投标")).doesNotThrowAnyException();
    assertThatCode(() -> TenderPolicy.requireFailable(
        tender("公开招标", "评标中", "<p>x</p>", now, now, now), "评审全部不合格")).doesNotThrowAnyException();
    assertThatCode(() -> TenderPolicy.requireFailable(
        tender("公开招标", "发售中", "<p>x</p>", now, now, now), "递交截止无投标", now)).doesNotThrowAnyException();
    assertThatThrownBy(() -> TenderPolicy.requireFailable(
        tender("公开招标", "发售中", "<p>x</p>", now, now.plusMinutes(1), now.plusMinutes(2)), "未截止", now))
        .hasMessageContaining("递交截止后");
    assertThatThrownBy(() -> TenderPolicy.requireFailable(
        tender("公开招标", "发售中", "<p>x</p>", now, null, now), "缺少时间", now))
        .hasMessageContaining("递交截止后");
    assertThatThrownBy(() -> TenderPolicy.requireFailable(
        tender("公开招标", "已开标", "<p>x</p>", now, now, now), "长".repeat(1001), now))
        .hasMessageContaining("1000");
    assertThatThrownBy(() -> TenderPolicy.requireFailable(
        tender("公开招标", "已定标", "<p>x</p>", now, now, now), "r")).hasMessageContaining("开标后、定标前");
    assertThatThrownBy(() -> TenderPolicy.requireFailable(
        tender("公开招标", "已开标", "<p>x</p>", now, now, now), " ")).hasMessageContaining("流标原因");

    assertThatCode(() -> TenderPolicy.requireRebiddable(
        tender("公开招标", "已流标", "<p>x</p>", now, now, now))).doesNotThrowAnyException();
    assertThatThrownBy(() -> TenderPolicy.requireRebiddable(
        tender("公开招标", "已开标", "<p>x</p>", now, now, now))).hasMessageContaining("仅已流标");
  }

  // ── C-7 中标转执行 ───────────────────────────────────────────
  @Test
  void executionOnlyForAwardedTenderOnce() {
    var now = OffsetDateTime.now();
    assertThatCode(() -> TenderPolicy.requireExecutable(
        tender("公开招标", "已定标", "<p>x</p>", now, now, now))).doesNotThrowAnyException();
    assertThatThrownBy(() -> TenderPolicy.requireExecutable(
        tender("公开招标", "评标中", "<p>x</p>", now, now, now))).hasMessageContaining("仅已定标");
    var executed = new Tender("tender-1", "tenant-1", "ZB20260716001", "测试招标", "公开招标",
        BigDecimal.valueOf(100000), "已定标", "<p>x</p>", "综合评分法", null,
        now, now, now, "user-1", null, now, now, null, "tbid-1", now, "<p>n</p>", null, null, null, "po-1", false);
    assertThatThrownBy(() -> TenderPolicy.requireExecutable(executed))
        .hasMessageContaining("不可重复生成");
  }

  // ── C-9 评标问询与二次报价 ───────────────────────────────────
  @Test
  void inquiryOnlyDuringEvaluationForUnsealedBid() {
    var now = OffsetDateTime.now();
    var evaluating = tender("公开招标", "评标中", "<p>x</p>", now, now, now);
    var openedBid = new com.procurement.tender.domain.TenderBid(
        "tbid-1", "t", "tender-1", "s", BigDecimal.TEN, "<p>doc</p>", "digest", "已开启", now, null);
    assertThatCode(() -> com.procurement.tender.domain.TenderInquiryPolicy.requireInquiryOpen(
        evaluating, openedBid, "澄清问询")).doesNotThrowAnyException();
    assertThatThrownBy(() -> com.procurement.tender.domain.TenderInquiryPolicy.requireInquiryOpen(
        tender("公开招标", "已开标", "<p>x</p>", now, now, now), openedBid, "澄清问询"))
        .hasMessageContaining("评标中");
    assertThatThrownBy(() -> com.procurement.tender.domain.TenderInquiryPolicy.requireInquiryOpen(
        evaluating, null, "澄清问询")).hasMessageContaining("已解封的有效投标");
    assertThatThrownBy(() -> com.procurement.tender.domain.TenderInquiryPolicy.requireInquiryOpen(
        evaluating, openedBid, "闲聊")).hasMessageContaining("澄清问询 或 二次报价");
  }

  @Test
  void inquiryAnswerRules() {
    var now = OffsetDateTime.now();
    var evaluating = tender("公开招标", "评标中", "<p>x</p>", now, now, now);
    var open = new com.procurement.tender.domain.TenderInquiry(
        "tinq-1", "t", "tender-1", "tbid-1", "二次报价", "请重新报价", now, null, null, null);
    assertThatCode(() -> com.procurement.tender.domain.TenderInquiryPolicy.requireAnswerable(evaluating, open))
        .doesNotThrowAnyException();
    var answered = new com.procurement.tender.domain.TenderInquiry(
        "tinq-1", "t", "tender-1", "tbid-1", "二次报价", "请重新报价", now, "ok", BigDecimal.TEN, now);
    assertThatThrownBy(() -> com.procurement.tender.domain.TenderInquiryPolicy.requireAnswerable(evaluating, answered))
        .hasMessageContaining("已答复");
    assertThatThrownBy(() -> com.procurement.tender.domain.TenderInquiryPolicy.requireAnswerable(
        tender("公开招标", "已定标", "<p>x</p>", now, now, now), open))
        .hasMessageContaining("评标已结束");

    assertThatThrownBy(() -> com.procurement.tender.domain.TenderInquiryPolicy.requireValidAnswer(
        "二次报价", "同意下调", null)).hasMessageContaining("正数修订报价");
    assertThatThrownBy(() -> com.procurement.tender.domain.TenderInquiryPolicy.requireValidAnswer(
        "澄清问询", "说明如下", BigDecimal.TEN)).hasMessageContaining("不得修改报价");
    assertThatCode(() -> com.procurement.tender.domain.TenderInquiryPolicy.requireValidAnswer(
        "二次报价", "下调至十万", BigDecimal.TEN)).doesNotThrowAnyException();
  }
}
