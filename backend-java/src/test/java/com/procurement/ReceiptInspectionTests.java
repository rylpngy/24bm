package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.procurement.order.domain.ReceiptInspection;
import org.junit.jupiter.api.Test;

// 验收结论判定 + 不合格须处置。
class ReceiptInspectionTests {

  @Test
  void concludesByReceivedVsQualified() {
    assertThat(ReceiptInspection.conclude(10, 10)).isEqualTo(ReceiptInspection.ALL_QUALIFIED);
    assertThat(ReceiptInspection.conclude(10, 6)).isEqualTo(ReceiptInspection.PARTIAL);
    assertThat(ReceiptInspection.conclude(10, 0)).isEqualTo(ReceiptInspection.ALL_REJECTED);
    // 未填数量退化为全部合格(兼容抬头级收货)。
    assertThat(ReceiptInspection.conclude(0, 0)).isEqualTo(ReceiptInspection.ALL_QUALIFIED);
  }

  @Test
  void unqualifiedRequiresValidDisposition() {
    assertThatThrownBy(() -> ReceiptInspection.requireDisposition(ReceiptInspection.PARTIAL, null))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("须选择处置方式");
    assertThatThrownBy(() -> ReceiptInspection.requireDisposition(ReceiptInspection.ALL_REJECTED, "随便填"))
        .isInstanceOf(IllegalStateException.class);
    assertThatCode(() -> ReceiptInspection.requireDisposition(ReceiptInspection.PARTIAL, ReceiptInspection.CONCESSION))
        .doesNotThrowAnyException();
    // 全部合格不要求处置。
    assertThatCode(() -> ReceiptInspection.requireDisposition(ReceiptInspection.ALL_QUALIFIED, null))
        .doesNotThrowAnyException();
  }
}
