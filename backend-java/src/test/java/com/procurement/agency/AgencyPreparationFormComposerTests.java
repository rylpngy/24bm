package com.procurement.agency;

import static org.assertj.core.api.Assertions.*;

import com.procurement.agency.application.AgencyPreparationFormComposer;
import com.procurement.agency.domain.AgencyExecutionRecords.PreparationPerson;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import org.apache.poi.xwpf.usermodel.*;
import org.junit.jupiter.api.Test;

class AgencyPreparationFormComposerTests {
  private final AgencyPreparationFormComposer c = new AgencyPreparationFormComposer();

  private PreparationPerson person(String id, String name, String role) {
    return new PreparationPerson(
        id, "t", "p", name, "合成技术单位", role, "active", 1, "技术样例", "u", null, null);
  }

  private final Map<String, String> fields =
      Map.of(
          "projectTitle",
          "会前准备技术验收项目",
          "projectNumber",
          "ZC-FW-202611-0001",
          "procurementMethod",
          "竞争性磋商",
          "scheduledAt",
          "2026年11月9日 09:00",
          "venue",
          "合成会议室A");

  @Test
  void producesFourEditableFixturesWithBlankSignatureFieldsAndExplicitSourceCode()
      throws Exception {
    var dir = Path.of("target/test-fixtures/preparation-forms");
    Files.createDirectories(dir);
    for (var kind : List.of("attendance", "disclosure", "confidentiality", "integrity")) {
      var people =
          kind.equals("attendance")
              ? List.of(
                  person("a", "张某", "organizer"),
                  person("b", "李某", "qualification_reviewer"),
                  person("c", "王某", "conformity_reviewer"))
              : List.of(person("a", "张某", "organizer"));
      byte[] bytes =
          c.compose(
              AgencyPreparationFormComposer.KINDS.get(kind),
              "PF20261108-TECHNICAL01",
              kind,
              people,
              fields,
              "合成技术样例 仅用于验证表单生成与签署件关联\n实际适用内容由项目人员核对，不预填签名或到场结论。");
      Files.write(dir.resolve(kind + ".docx"), bytes);
      try (var doc = new XWPFDocument(new ByteArrayInputStream(bytes))) {
        String body =
            String.join("\n", doc.getParagraphs().stream().map(XWPFParagraph::getText).toList());
        assertThat(body).contains("会前准备技术验收项目", "ZC-FW-202611-0001", "生成表单不代表人员已到场或已签署");
        assertThat(doc.getParagraphs().getFirst().getStyle()).isEqualTo("Title");
        assertThat(doc.getFooterList().getFirst()._getHdrFtr().xmlText())
            .contains("PF20261108-TECHNICAL01", "PAGE");
        if (kind.equals("attendance")) {
          var table = doc.getTables().getFirst();
          assertThat(table.getRows()).hasSize(4);
          assertThat(table.getRow(1).getCell(3).getText()).isEmpty();
          assertThat(table.getRow(1).getCell(4).getText()).isEmpty();
          assertThat(table.getRow(2).getCell(2).getText()).contains("资格审查人员");
          assertThat(table.getRow(3).getCell(2).getText()).contains("符合性审查人员");
          assertThat(table.getRow(0).isRepeatHeader()).isTrue();
        } else assertThat(body).contains("本人签名：________________", "签署日期：________________");
      }
    }
  }

  @Test
  void longRosterHasRepeatingHeadersAndNonSplittingRows() throws Exception {
    var people =
        java.util.stream.IntStream.range(0, 30)
            .mapToObj(
                i ->
                    new PreparationPerson(
                        "p" + i,
                        "t",
                        "pkg",
                        "合成人员" + (i + 1),
                        "技术验收单位 第" + (i + 1) + "组",
                        "review_member",
                        "active",
                        1,
                        "测试",
                        "u",
                        null,
                        null))
            .toList();
    var bytes =
        c.compose(
            "人员签到表", "PF20261108-LONGROSTER", "attendance", people, fields, "30名合成人员的分页排版验证样例");
    Files.createDirectories(Path.of("target/test-fixtures/preparation-forms"));
    Files.write(Path.of("target/test-fixtures/preparation-forms/attendance-long.docx"), bytes);
    try (var doc = new XWPFDocument(new ByteArrayInputStream(bytes))) {
      var t = doc.getTables().getFirst();
      assertThat(t.getRows()).hasSize(31);
      assertThat(t.getRow(0).isRepeatHeader()).isTrue();
      assertThat(t.getRows().subList(1, 31)).allMatch(XWPFTableRow::isCantSplitRow);
    }
  }

  @Test
  void userTextIsPlainTextNotHtmlOrTemplateInstructions() throws Exception {
    byte[] bytes =
        c.compose(
            "回避事项声明表",
            "PF-X",
            "disclosure",
            List.of(person("a", "<甲&乙>", "other")),
            fields,
            "<script>alert(1)</script> {{do-not-execute}}");
    try (var doc = new XWPFDocument(new ByteArrayInputStream(bytes))) {
      assertThat(
              String.join("\n", doc.getParagraphs().stream().map(XWPFParagraph::getText).toList()))
          .contains("<script>alert(1)</script>", "{{do-not-execute}}", "<甲&乙>");
    }
  }

  @Test
  void fileCreatorAndGeneralFileConfidentialPermissionDoNotBypassPreparationConfidentiality() {
    var guard = org.mockito.Mockito.mock(com.procurement.agency.application.AgencyGuard.class);
    var permissions =
        org.mockito.Mockito.mock(com.procurement.identity.application.PermissionService.class);
    org.mockito.Mockito.when(guard.permissions()).thenReturn(permissions);
    org.mockito.Mockito.when(guard.actor()).thenReturn("u");
    org.mockito.Mockito.when(permissions.currentUserHas("buyer:agency:file:confidential"))
        .thenReturn(true);
    var access =
        new com.procurement.agency.application.AgencyFileAccess(
            null, guard, null, null, null, null, null);
    for (String category : List.of("preparation_form", "preparation_signed")) {
      var f =
          new com.procurement.agency.domain.AgencyRecords.FileRow(
              "f", "t", "p", "private", category, "restricted", "u", null);
      assertThat(access.visible(f)).isFalse();
      org.mockito.Mockito.when(permissions.currentUserHas("buyer:agency:preparation:confidential"))
          .thenReturn(true);
      assertThat(access.visible(f)).isTrue();
      org.mockito.Mockito.when(permissions.currentUserHas("buyer:agency:preparation:confidential"))
          .thenReturn(false);
    }
  }
}
