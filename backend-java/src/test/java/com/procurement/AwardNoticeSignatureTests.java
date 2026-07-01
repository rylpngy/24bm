package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.procurement.sourcing.domain.AwardNoticeSignature;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

// 中标通知书数字签名:签名确定性 + 验签 + 篡改检测。
class AwardNoticeSignatureTests {

  @AfterEach
  void clearSecretOverrides() {
    System.clearProperty(AwardNoticeSignature.SECRET_PROPERTY);
    System.clearProperty(AwardNoticeSignature.ALLOW_DEMO_SECRET_PROPERTY);
  }

  private String canonical(String amount) {
    return AwardNoticeSignature.canonical(
        "rfq-1", "办公电脑询价", "询价", "ent-supplier-sunrise",
        amount, "ZB-ABC", "user-buyer-owner", "2026-06-30T10:00:00+08:00");
  }

  @Test
  void signIsDeterministicAndVerifies() {
    String c = canonical("118000");
    String sig = AwardNoticeSignature.sign(c);
    assertThat(sig).isEqualTo(AwardNoticeSignature.sign(c)); // 确定性
    assertThat(sig).hasSize(64); // HMAC-SHA256 → 32 字节 → 64 hex
    assertThat(AwardNoticeSignature.verify(c, sig)).isTrue();
  }

  @Test
  void tamperedContentFailsVerification() {
    String sig = AwardNoticeSignature.sign(canonical("118000"));
    // 金额被改 → 验签失败(防伪)。
    assertThat(AwardNoticeSignature.verify(canonical("99999"), sig)).isFalse();
    assertThat(AwardNoticeSignature.verify(canonical("118000"), null)).isFalse();
    assertThat(AwardNoticeSignature.verify(canonical("118000"), "deadbeef")).isFalse();
  }

  @Test
  void configuredSecretChangesSignatureAndVerificationBoundary() {
    String c = canonical("118000");

    System.setProperty(AwardNoticeSignature.SECRET_PROPERTY, "pilot-secret-one-with-enough-entropy");
    String first = AwardNoticeSignature.sign(c);

    System.setProperty(AwardNoticeSignature.SECRET_PROPERTY, "pilot-secret-two-with-enough-entropy");
    String second = AwardNoticeSignature.sign(c);

    assertThat(second).isNotEqualTo(first);
    assertThat(AwardNoticeSignature.verify(c, first)).isFalse();

    System.setProperty(AwardNoticeSignature.SECRET_PROPERTY, "pilot-secret-one-with-enough-entropy");
    assertThat(AwardNoticeSignature.verify(c, first)).isTrue();
  }

  @Test
  void rejectsMissingSecretWhenDemoSecretIsDisabled() {
    System.clearProperty(AwardNoticeSignature.SECRET_PROPERTY);
    System.setProperty(AwardNoticeSignature.ALLOW_DEMO_SECRET_PROPERTY, "false");

    assertThatThrownBy(() -> AwardNoticeSignature.sign(canonical("118000")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Award notice signature secret must be configured");
  }
}
