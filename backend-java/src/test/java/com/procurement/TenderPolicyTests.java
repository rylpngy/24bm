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
        acq, sub, open, "user-1", null, OffsetDateTime.now(), OffsetDateTime.now());
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
}
