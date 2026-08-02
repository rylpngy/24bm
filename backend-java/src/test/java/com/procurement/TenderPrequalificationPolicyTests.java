package com.procurement;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.procurement.tender.domain.Tender;
import com.procurement.tender.domain.TenderPrequalification;
import com.procurement.tender.domain.TenderPrequalificationPolicy;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** F-1 资格预审规则:开关时机、申请与审查前置、领取门槛。 */
class TenderPrequalificationPolicyTests {

  private static Tender tender(String status, boolean required) {
    return new Tender(
        "tender-1", "tenant-1", "ZB001", "机房改造", "公开招标", new BigDecimal("100000"),
        status, "<p>正文</p>", "综合评分法", BigDecimal.ZERO, null, null, null, "user-1",
        null, null, null, null, null, null, null, null, null, null, null, required);
  }

  private static TenderPrequalification application(String status) {
    return new TenderPrequalification(
        "tpq-1", "tenant-1", "tender-1", "supplier-1", "具备三级资质", status, null,
        OffsetDateTime.parse("2026-01-01T09:00:00+08:00"), null);
  }

  @Test
  @DisplayName("预审开关仅编制中可设定,发售后拒绝变更")
  void toggleOnlyWhileDrafting() {
    assertThatCode(() -> TenderPrequalificationPolicy.requireToggleable(tender("编制中", false)))
        .doesNotThrowAnyException();
    assertThatThrownBy(() -> TenderPrequalificationPolicy.requireToggleable(tender("发售中", true)))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("编制中");
  }

  @Test
  @DisplayName("未开启预审不接受申请;审查中不可重复提交;驳回后可重新提交")
  void applyGuards() {
    assertThatThrownBy(() -> TenderPrequalificationPolicy.requireApplicable(
            tender("发售中", false), null, "声明"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("未开启资格预审");
    assertThatThrownBy(() -> TenderPrequalificationPolicy.requireApplicable(
            tender("发售中", true), application("待审查"), "声明"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("审查中");
    assertThatThrownBy(() -> TenderPrequalificationPolicy.requireApplicable(
            tender("发售中", true), application("已通过"), "声明"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("重复申请");
    assertThatThrownBy(() -> TenderPrequalificationPolicy.requireApplicable(
            tender("发售中", true), null, "  "))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatCode(() -> TenderPrequalificationPolicy.requireApplicable(
            tender("发售中", true), application("未通过"), "补充业绩后重新申请"))
        .doesNotThrowAnyException();
  }

  @Test
  @DisplayName("审查结论限已通过/未通过且意见必填,已审查的申请不可再判")
  void reviewGuards() {
    assertThatThrownBy(() -> TenderPrequalificationPolicy.requireReviewable(
            tender("发售中", true), application("待审查"), "待定", "意见"))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> TenderPrequalificationPolicy.requireReviewable(
            tender("发售中", true), application("待审查"), "已通过", " "))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("审查意见");
    assertThatThrownBy(() -> TenderPrequalificationPolicy.requireReviewable(
            tender("发售中", true), application("已通过"), "未通过", "意见"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("已审查");
    assertThatThrownBy(() -> TenderPrequalificationPolicy.requireReviewable(
            tender("发售中", true), null, "已通过", "意见"))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatCode(() -> TenderPrequalificationPolicy.requireReviewable(
            tender("发售中", true), application("待审查"), "已通过", "资质业绩满足要求"))
        .doesNotThrowAnyException();
  }

  @Test
  @DisplayName("领取门槛:未开启预审直接放行,开启后须预审通过")
  void acquireGate() {
    assertThatCode(() -> TenderPrequalificationPolicy.requirePrequalified(tender("发售中", false), null))
        .doesNotThrowAnyException();
    assertThatThrownBy(() -> TenderPrequalificationPolicy.requirePrequalified(tender("发售中", true), null))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("请先提交资格预审申请");
    assertThatThrownBy(() -> TenderPrequalificationPolicy.requirePrequalified(
            tender("发售中", true), application("待审查")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("暂不可领取");
    assertThatCode(() -> TenderPrequalificationPolicy.requirePrequalified(
            tender("发售中", true), application("已通过")))
        .doesNotThrowAnyException();
  }
}
