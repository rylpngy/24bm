package com.procurement.agency;

import static org.assertj.core.api.Assertions.*;

import com.procurement.agency.application.AgencyParticipationImportParser;
import java.io.*;
import java.nio.charset.StandardCharsets;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;

class AgencyParticipationImportParserTests {
  private final AgencyParticipationImportParser p = new AgencyParticipationImportParser();

  private byte[] bytes(String s) {
    return s.getBytes(StandardCharsets.UTF_8);
  }

  @Test
  void utf8BomQuotedCommaEscapedQuoteAndLeadingZerosArePreserved() {
    var rows =
        p.parse(
            "test.csv",
            bytes(
                "\uFEFF供应商名称,联系电话,备注\r\n\"甲,乙公司\",00123,\"第一行\n第二行\"\r\n\"丙\"\"丁公司\",0099,说明\r\n"));
    assertThat(rows).hasSize(2);
    assertThat(rows.getFirst().data().supplierName()).isEqualTo("甲,乙公司");
    assertThat(rows.getFirst().data().phone()).isEqualTo("00123");
    assertThat(rows.getFirst().data().notes()).isEqualTo("第一行\n第二行");
    assertThat(rows.getLast().data().supplierName()).isEqualTo("丙\"丁公司");
    assertThat(rows.getFirst().rowNumber()).isEqualTo(2);
  }

  @Test
  void qualificationAndAdmissionStatusesAreErrorsNotImportedConclusions() {
    var row = p.parse("x.csv", bytes("供应商名称,文件获取情况,响应递交情况,风险复核情况\n甲公司,准入批准,资格合格,合格")).getFirst();
    assertThat(row.errors()).hasSize(3);
    assertThat(row.data().submissionStatus()).isEqualTo("unknown");
  }

  @Test
  void missingSupplierNameProducesAnInvalidRow() {
    assertThat(p.parse("x.csv", bytes("供应商名称,联系电话\n,00123")).getFirst().errors())
        .anyMatch(e -> e.contains("名称必填"));
  }

  @Test
  void invalidEncodingAndMalformedQuotesAreRejected() {
    assertThatThrownBy(() -> p.parse("x.csv", new byte[] {(byte) 0xff}))
        .hasMessageContaining("UTF-8");
    assertThatThrownBy(() -> p.parse("x.csv", bytes("供应商名称\n\"未闭合"))).hasMessageContaining("未闭合");
    assertThatThrownBy(() -> p.parse("x.csv", bytes("供应商名称\n\"甲\"非法"))).hasMessageContaining("非法");
  }

  @Test
  void unknownOrDuplicateHeadersAreRejected() {
    assertThatThrownBy(() -> p.parse("x.csv", bytes("供应商名称,准入批准\n甲公司,是")))
        .hasMessageContaining("表头");
    assertThatThrownBy(() -> p.parse("x.csv", bytes("供应商名称,供应商名称\n甲公司,乙公司")))
        .hasMessageContaining("表头");
  }

  @Test
  void moreThanTwoHundredRecordsIsRejectedBeforeImport() {
    assertThatThrownBy(() -> p.parse("x.csv", bytes("供应商名称\n" + "甲公司\n".repeat(201))))
        .hasMessageContaining("200");
  }

  @Test
  void formulaOnlyExcelRowIsNotSilentlyDroppedAndNoFormulaIsEvaluated() throws Exception {
    try (var workbook = new XSSFWorkbook();
        var out = new ByteArrayOutputStream()) {
      var sh = workbook.createSheet();
      sh.createRow(0).createCell(0).setCellValue("供应商名称");
      sh.createRow(1).createCell(0).setCellFormula("1+1");
      sh.createRow(2).createCell(0).setCellValue("真实文本");
      workbook.write(out);
      var rows = p.parse("x.xlsx", out.toByteArray());
      assertThat(rows).hasSize(2);
      assertThat(rows.getFirst().errors()).anyMatch(e -> e.contains("公式"));
      assertThat(rows.getFirst().data().supplierName()).isEmpty();
    }
  }

  @Test
  void numericExcelPhoneIsFlaggedForPrecisionReview() throws Exception {
    try (var workbook = new XSSFWorkbook();
        var out = new ByteArrayOutputStream()) {
      var sh = workbook.createSheet();
      var header = sh.createRow(0);
      header.createCell(0).setCellValue("供应商名称");
      header.createCell(1).setCellValue("联系电话");
      var row = sh.createRow(1);
      row.createCell(0).setCellValue("甲公司");
      row.createCell(1).setCellValue(123);
      workbook.write(out);
      assertThat(p.parse("x.xlsx", out.toByteArray()).getFirst().warnings())
          .anyMatch(w -> w.contains("前导零"));
    }
  }

  @Test
  void multiplePopulatedSheetsAreRejected() throws Exception {
    try (var workbook = new XSSFWorkbook();
        var out = new ByteArrayOutputStream()) {
      workbook.createSheet().createRow(0).createCell(0).setCellValue("供应商名称");
      workbook.createSheet().createRow(0).createCell(0).setCellValue("供应商名称");
      workbook.write(out);
      assertThatThrownBy(() -> p.parse("x.xlsx", out.toByteArray())).hasMessageContaining("一个有数据");
    }
  }

  @Test
  void csvFormulaPrefixesAreFlaggedForCorrection() {
    assertThat(p.parse("x.csv", bytes("供应商名称\n=1+1")).getFirst().errors())
        .anyMatch(e -> e.contains("疑似公式"));
  }

  @Test
  void textExcelCodesRetainLeadingZerosAndProvideHttpFixture() throws Exception {
    try (var workbook = new XSSFWorkbook();
        var out = new ByteArrayOutputStream()) {
      var sh = workbook.createSheet();
      var h = sh.createRow(0);
      h.createCell(0).setCellValue("供应商名称");
      h.createCell(1).setCellValue("统一社会信用代码");
      h.createCell(2).setCellValue("联系电话");
      var r = sh.createRow(1);
      r.createCell(0).setCellValue("HTTP XLSX测试公司");
      r.createCell(1).setCellValue("0000123");
      r.createCell(2).setCellValue("00123");
      workbook.write(out);
      var row = p.parse("fixture.xlsx", out.toByteArray()).getFirst();
      assertThat(row.data().creditCode()).isEqualTo("0000123");
      assertThat(row.data().phone()).isEqualTo("00123");
      var dir = java.nio.file.Path.of("target/test-fixtures");
      java.nio.file.Files.createDirectories(dir);
      java.nio.file.Files.write(dir.resolve("agency-participation.xlsx"), out.toByteArray());
    }
  }
}
