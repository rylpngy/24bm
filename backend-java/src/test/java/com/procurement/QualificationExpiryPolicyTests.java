package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.procurement.supplier.domain.QualificationExpiryPolicy;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

// 资质有效期提醒规则(E-1):相对今天判定,避免写死日期随时间翻车。
class QualificationExpiryPolicyTests {

  private final LocalDate today = LocalDate.now();

  @Test
  void expiryStateBoundaries() {
    assertThat(QualificationExpiryPolicy.expiryState(null, today))
        .isEqualTo(QualificationExpiryPolicy.STATE_NO_EXPIRY);
    assertThat(QualificationExpiryPolicy.expiryState(today.minusDays(1), today))
        .isEqualTo(QualificationExpiryPolicy.STATE_EXPIRED);
    // 今天到期与第 30 天到期都算临期
    assertThat(QualificationExpiryPolicy.expiryState(today, today))
        .isEqualTo(QualificationExpiryPolicy.STATE_EXPIRING);
    assertThat(QualificationExpiryPolicy.expiryState(today.plusDays(30), today))
        .isEqualTo(QualificationExpiryPolicy.STATE_EXPIRING);
    // 第 31 天起为有效
    assertThat(QualificationExpiryPolicy.expiryState(today.plusDays(31), today))
        .isEqualTo(QualificationExpiryPolicy.STATE_VALID);
  }

  @Test
  void daysToExpirySignedAndNullable() {
    assertThat(QualificationExpiryPolicy.daysToExpiry(null, today)).isNull();
    assertThat(QualificationExpiryPolicy.daysToExpiry(today.plusDays(7), today)).isEqualTo(7);
    assertThat(QualificationExpiryPolicy.daysToExpiry(today.minusDays(3), today)).isEqualTo(-3);
  }

  @Test
  void uploadedFileRequiredBeforeArchiving() {
    assertThatThrownBy(() -> QualificationExpiryPolicy.requireUploadedFile(null, "key"))
        .hasMessageContaining("请先上传证照文件");
    assertThatThrownBy(() -> QualificationExpiryPolicy.requireUploadedFile("a.pdf", " "))
        .hasMessageContaining("请先上传证照文件");
    assertThatCode(() -> QualificationExpiryPolicy.requireUploadedFile("a.pdf", "supplier-qualifications/s/x-a.pdf"))
        .doesNotThrowAnyException();
  }
}
