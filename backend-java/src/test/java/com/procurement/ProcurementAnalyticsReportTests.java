package com.procurement;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.lowagie.text.pdf.*;
import com.procurement.buyer.application.BuyerAnalyticsApplicationService;
import com.procurement.buyer.application.BuyerAnalyticsReportQuery;
import com.procurement.buyer.domain.*;
import com.procurement.buyer.infrastructure.BuyerAnalyticsMapper;
import com.procurement.common.tenant.TenantContext;
import com.procurement.finance.application.*;
import com.procurement.finance.infrastructure.ProcurementAnalyticsReportRenderer;
import com.procurement.identity.application.PermissionService;
import java.io.ByteArrayInputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.IntStream;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class ProcurementAnalyticsReportTests {
  @AfterEach void clear() { TenantContext.clear(); }

  @Test void bothAnalyticsExportEntrypointsAvoidAnOuterConnectionHoldingTransaction() throws Exception {
    for (var parameters : List.of(new Class<?>[]{String.class}, new Class<?>[]{String.class, LocalDate.class, LocalDate.class, String.class, String.class})) {
      var tx = FinanceReportApplicationService.class.getMethod("exportProcurementAnalytics", parameters)
          .getAnnotation(org.springframework.transaction.annotation.Transactional.class);
      assertThat(tx).isNotNull();
      assertThat(tx.propagation()).isEqualTo(org.springframework.transaction.annotation.Propagation.NOT_SUPPORTED);
    }
    assertThat(FinanceReportApplicationService.class.getAnnotation(org.springframework.transaction.annotation.Transactional.class).readOnly()).isTrue();
  }

  private com.procurement.buyer.api.ProcurementAnalyticsResponse sample() {
    TenantContext.set("tenant-1", null, "user");
    var mapper = mock(BuyerAnalyticsMapper.class);
    when(mapper.monthlySpend(anyString(), any(), any())).thenReturn(List.of(new MonthlySpend("2026-02", new BigDecimal("123.45"), 12)));
    when(mapper.supplierSpend(anyString(), any(), any())).thenReturn(IntStream.range(0, 12).mapToObj(i -> new SupplierSpend("s" + i, "Supplier " + i, new BigDecimal(i == 0 ? "13.45" : "10.00"), 1)).toList());
    when(mapper.statusDistribution(anyString(), any(), any())).thenReturn(List.of(new StatusSlice("已收货", 12, new BigDecimal("123.45"))));
    when(mapper.categorySpend(anyString(), any(), any())).thenReturn(List.of(new CategorySpend("Estimate", new BigDecimal("555.55"))));
    when(mapper.biddingSavings(anyString(), any(), any())).thenReturn(new BigDecimal("2.01"));
    return new BuyerAnalyticsApplicationService(mapper, mock(PermissionService.class), TestDataScopes.unrestricted())
        .procurementAnalytics(LocalDate.parse("2026-01-01"), LocalDate.parse("2026-03-31"), null, null);
  }

  @Test void workbookContainsFullRankDefinitionsAndNumericMoney() throws Exception {
    try (var book = new XSSFWorkbook(new ByteArrayInputStream(ProcurementAnalyticsReportRenderer.toXlsx(sample())))) {
      assertThat(book.getNumberOfSheets()).isEqualTo(6);
      assertThat(book.getSheet("供应商").getLastRowNum()).isEqualTo(12);
      assertThat(book.getSheet("供应商").getRow(1).getCell(2).getCellType()).isEqualTo(CellType.NUMERIC);
      assertThat(book.getSheet("供应商").getRow(1).getCell(2).getNumericCellValue()).isEqualTo(13.45);
      assertThat(book.getSheet("月度").getRow(2).getCell(2).getNumericCellValue()).isEqualTo(123.45);
      var text = new StringBuilder();
      for (var row : book.getSheet("定义与筛选")) for (var cell : row) text.append(cell.toString());
      assertThat(text.toString()).contains("2026-01-01", "2026-03-31", "Asia/Shanghai", "procurement-analytics-v2", "估算", "付款");
    }
  }

  @Test void pdfContainsEveryEquivalentSectionAndFullSupplierRank() throws Exception {
    byte[] bytes = ProcurementAnalyticsReportRenderer.toPdf(sample());
    if (System.getProperty("analytics.qaDir") != null) {
      java.nio.file.Files.write(java.nio.file.Path.of(System.getProperty("analytics.qaDir"), "analytics-report.pdf"), bytes);
    }
    var reader = new PdfReader(bytes);
    try {
      var text = new StringBuilder();
      // OpenPDF's extractor cannot decode its own unembedded CJK fonts without ToUnicode.
      // Parse text operands using the declared UniGB-UCS2-H font encoding instead.
      for (int page = 1; page <= reader.getNumberOfPages(); page++) {
        var resources = reader.getPageN(page).getAsDict(PdfName.RESOURCES).getAsDict(PdfName.FONT);
        for (PdfName key : resources.getKeys()) assertThat(resources.getAsDict(key).getAsName(PdfName.ENCODING)).isEqualTo(new PdfName("UniGB-UCS2-H"));
        var parser = new PdfContentParser(new PRTokeniser(new RandomAccessFileOrArray(reader.getPageContent(page))));
        var operands = new java.util.ArrayList<PdfObject>();
        var pageText = new StringBuilder();
        while (!parser.parse(operands).isEmpty()) for (var operand : operands) appendText(operand, pageText);
        if (pageText.toString().contains("月度")) assertThat(pageText.toString()).contains("月份");
        text.append(pageText);
      }
      assertThat(text.toString()).contains("定义与筛选", "汇总", "月度", "供应商", "订单状态", "需求参考金额估算", "Supplier 11", "123.45", "555.55");
    } finally { reader.close(); }
  }

  private void appendText(PdfObject value, StringBuilder text) {
    if (value instanceof PdfString string) text.append(new String(string.getOriginalBytes(), java.nio.charset.StandardCharsets.UTF_16BE));
    if (value instanceof PdfArray array) for (var element : array.getElements()) appendText(element, text);
  }

  @Test void exportCallsOtherAnalyticsBeanWithIdenticalFiltersAndBothPermissions() {
    var analytics = mock(BuyerAnalyticsApplicationService.class);
    var query = new BuyerAnalyticsReportQuery(analytics);
    var access = mock(FinanceAccessService.class);
    var sample = sample();
    var from = LocalDate.parse("2026-01-01");
    var to = LocalDate.parse("2026-03-31");
    when(analytics.procurementAnalytics(from, to, "s", "已收货")).thenReturn(sample);
    var reports = new FinanceReportApplicationService(access, null, null, query);
    assertThat(reports.exportProcurementAnalytics("xlsx", from, to, "s", "已收货").content()).isNotEmpty();
    verify(access).requireScope("buyer:analytics:read");
    verify(access).requireScope("buyer:report:export");
    verify(analytics).procurementAnalytics(from, to, "s", "已收货");
    assertThatThrownBy(() -> reports.exportProcurementAnalytics("csv", from, to, "s", "已收货")).isInstanceOf(IllegalArgumentException.class);
  }
}
