package com.procurement.agency;

import static org.assertj.core.api.Assertions.*;

import com.procurement.agency.application.AgencyFileSafety;
import com.procurement.agency.domain.*;
import java.io.*;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.zip.*;
import org.junit.jupiter.api.Test;

class AgencyPolicyTests {
  final String pattern = "{category}-{object}-{yyyyMM}-{serial}";

  @Test
  void monthlyCategoryChangesDoNotAlterSuppliedAnnualSerial() {
    assertThat(AgencyPolicy.number(pattern, "ZC", "FW", "202611", 42))
        .isEqualTo("ZC-FW-202611-0042");
    assertThat(AgencyPolicy.number(pattern, "DL", "HW", "202612", 43)).endsWith("0043");
    assertThat(AgencyPolicy.number(pattern, "ZC", "FW", "202701", 1)).endsWith("0001");
  }

  @Test
  void overflowAndWrappingAreRejected() {
    assertThatThrownBy(() -> AgencyPolicy.number(pattern, "ZC", "FW", "202611", 10000))
        .hasMessageContaining("9999");
    assertThatThrownBy(() -> AgencyPolicy.number(pattern, "ZC", "FW", "202611", 0))
        .isInstanceOf(IllegalStateException.class);
  }

  @Test
  void exactMoneyAndOptimisticVersionAreRequired() {
    assertThatThrownBy(() -> AgencyPolicy.amount(new BigDecimal("0.001"), "预算"))
        .hasMessageContaining("小数");
    assertThatThrownBy(() -> AgencyPolicy.amount(new BigDecimal("-1"), "预算"))
        .isInstanceOf(IllegalArgumentException.class);
    AgencyPolicy.amount(null, "预算");
    AgencyPolicy.amount(new BigDecimal("123456.78"), "预算");
    assertThatThrownBy(() -> AgencyPolicy.expected(4, 3L))
        .isInstanceOf(AgencyConflictException.class);
  }

  @Test
  void invalidPatternsAndTimezonesAreRejected() {
    AgencyPolicy.pattern(pattern, "Asia/Shanghai");
    assertThatThrownBy(() -> AgencyPolicy.pattern("{serial}", "Asia/Shanghai"))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> AgencyPolicy.pattern(pattern, "Invalid/Zone"))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void uploadDetectsExecutableContentDisguisedAsText() {
    var scan = new AgencyFileSafety();
    assertThatThrownBy(() -> scan.inspect("safe.txt", "MZmalware".getBytes()))
        .hasMessageContaining("可疑");
    assertThatThrownBy(() -> scan.inspect("../safe.txt", "hello".getBytes()))
        .hasMessageContaining("路径");
    assertThatThrownBy(
            () -> scan.inspect("safe.txt", "EICAR-STANDARD-ANTIVIRUS-TEST-FILE".getBytes()))
        .isInstanceOf(IllegalArgumentException.class);
    scan.inspect("中文.txt", "测试资料".getBytes(StandardCharsets.UTF_8));
  }

  @Test
  void officeMacrosAndEmbeddedExecutablesAreRejected() throws Exception {
    var out = new ByteArrayOutputStream();
    try (var zip = new ZipOutputStream(out)) {
      zip.putNextEntry(new ZipEntry("word/vbaProject.bin"));
      zip.write(new byte[] {1});
      zip.closeEntry();
    }
    assertThatThrownBy(() -> new AgencyFileSafety().inspect("document.docx", out.toByteArray()))
        .hasMessageContaining("宏");
  }
}
