package com.procurement.agency;

import static org.assertj.core.api.Assertions.*;

import com.procurement.agency.application.AgencyDocxComposer;
import com.procurement.agency.domain.AgencyExecutionRecords.Chapter;
import java.io.*;
import java.util.*;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.junit.jupiter.api.Test;

class AgencyExecutionCompositionTests {
  private final AgencyDocxComposer composer = new AgencyDocxComposer();

  @Test
  void preservesChapterOrderAndEscapesUserTextInActualDocx() throws Exception {
    byte[] bytes =
        composer.compose(
            "中文采购文件",
            List.of(
                new Chapter("demand", "采购需求", "项目 {{projectTitle}}\n<xml>&内容", true),
                new Chapter("contract", "合同", "{{supplierName}} {{awardAmount}}", true)),
            Map.of("projectTitle", "合成项目"));
    try (var doc = new XWPFDocument(new ByteArrayInputStream(bytes))) {
      String text = String.join("\n", doc.getParagraphs().stream().map(p -> p.getText()).toList());
      assertThat(text)
          .contains("项目 合成项目", "<xml>&内容", "（待成交后填写）")
          .doesNotContain("{{projectTitle}}", "{{supplierName}}");
      assertThat(text.indexOf("采购需求")).isLessThan(text.indexOf("合同"));
      assertThat(doc.getParagraphs().stream().filter(p -> "Heading1".equals(p.getStyle())).count())
          .isEqualTo(2);
      assertThat(doc.getFooterList().getFirst()._getHdrFtr().xmlText()).contains("PAGE");
    }
  }

  @Test
  void unknownPlaceholdersRemainVisibleForCompletenessGate() {
    assertThat(composer.expand("{{unknown}} / {{projectTitle}}", Map.of("projectTitle", "采购包")))
        .isEqualTo("{{unknown}} / 采购包");
  }

  @Test
  void replacingOneFieldCannotRecursivelyExpandInjectedPlaceholders() {
    // Text must be inserted once; values are not template instructions.
    assertThat(composer.expand("{{a}}", new TreeMap<>(Map.of("a", "{{z}}", "z", "unexpected"))))
        .isEqualTo("{{z}}");
  }
}
