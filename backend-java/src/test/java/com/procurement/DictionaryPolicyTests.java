package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.procurement.dictionary.domain.DictionaryEntry;
import com.procurement.dictionary.domain.DictionaryPolicy;
import org.junit.jupiter.api.Test;

// 平台字典维护规则(D-4):键格式、名称必填、状态归一、存在性守卫。
class DictionaryPolicyTests {

  @Test
  void keysMustBeMachineFriendly() {
    assertThatCode(() -> DictionaryPolicy.requireValidKey("payment_status", "字典类型"))
        .doesNotThrowAnyException();
    assertThatCode(() -> DictionaryPolicy.requireValidKey("partial-paid", "条目编码"))
        .doesNotThrowAnyException();
    assertThatThrownBy(() -> DictionaryPolicy.requireValidKey(" ", "字典类型"))
        .hasMessageContaining("不能为空");
    assertThatThrownBy(() -> DictionaryPolicy.requireValidKey("付款状态", "字典类型"))
        .hasMessageContaining("仅允许小写字母");
    assertThatThrownBy(() -> DictionaryPolicy.requireValidKey("Payment", "条目编码"))
        .hasMessageContaining("仅允许小写字母");
  }

  @Test
  void labelRequiredAndStatusNormalized() {
    assertThatThrownBy(() -> DictionaryPolicy.requireValidLabel("  ")).hasMessageContaining("显示名称");
    assertThat(DictionaryPolicy.normalizeStatus(null)).isEqualTo("active");
    assertThat(DictionaryPolicy.normalizeStatus("")).isEqualTo("active");
    assertThat(DictionaryPolicy.normalizeStatus("inactive")).isEqualTo("inactive");
    assertThatThrownBy(() -> DictionaryPolicy.normalizeStatus("deleted"))
        .hasMessageContaining("active 或 inactive");
  }

  @Test
  void duplicateAndMissingGuards() {
    DictionaryEntry existing = new DictionaryEntry("payment_status", "paid", "已付款", 30, "active");
    assertThatThrownBy(() -> DictionaryPolicy.requireAbsent(existing, "payment_status", "paid"))
        .hasMessageContaining("已存在");
    assertThatCode(() -> DictionaryPolicy.requireAbsent(null, "payment_status", "new_code"))
        .doesNotThrowAnyException();
    assertThatThrownBy(() -> DictionaryPolicy.requirePresent(null, "payment_status", "ghost"))
        .hasMessageContaining("不存在");
    assertThatCode(() -> DictionaryPolicy.requirePresent(existing, "payment_status", "paid"))
        .doesNotThrowAnyException();
  }
}
