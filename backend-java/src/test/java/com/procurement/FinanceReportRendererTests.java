package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;

import com.procurement.finance.infrastructure.FinanceReportRenderer;
import java.util.List;
import org.junit.jupiter.api.Test;

// 报表渲染:校验产出为真实的 .xlsx(ZIP 魔数 PK)与 PDF(%PDF),且中文不致渲染异常。
class FinanceReportRendererTests {

  private static final List<String> HEADERS = List.of("发票号", "金额", "状态");
  private static final List<List<String>> ROWS =
      List.of(List.of("INV-2026-0001", "88000.00", "待付款"), List.of("INV-2026-BIG1", "95000.00", "金额差异"));

  @Test
  void xlsxOutputIsNonEmptyZipWorkbook() {
    byte[] bytes = FinanceReportRenderer.toXlsx("发票清单", HEADERS, ROWS);
    assertThat(bytes.length).isGreaterThan(0);
    // .xlsx 是 OOXML(ZIP)容器,魔数 'P''K'。
    assertThat(bytes[0]).isEqualTo((byte) 'P');
    assertThat(bytes[1]).isEqualTo((byte) 'K');
  }

  @Test
  void pdfOutputStartsWithPdfMagicAndRendersChinese() {
    byte[] bytes = FinanceReportRenderer.toPdf("三单匹配对账单", HEADERS, ROWS);
    assertThat(bytes.length).isGreaterThan(0);
    String head = new String(bytes, 0, 5, java.nio.charset.StandardCharsets.ISO_8859_1);
    assertThat(head).startsWith("%PDF");
  }
}
