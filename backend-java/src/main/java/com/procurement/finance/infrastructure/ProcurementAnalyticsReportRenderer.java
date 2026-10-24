package com.procurement.finance.infrastructure;

import com.procurement.buyer.application.ProcurementAnalyticsView;
import com.lowagie.text.*;
import com.lowagie.text.pdf.*;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

/** Analytics-only renderer: XLSX and PDF consume exactly the same sections and values. */
public final class ProcurementAnalyticsReportRenderer {
  private ProcurementAnalyticsReportRenderer() {}

  private record Section(String name, List<String> headers, List<List<Object>> rows) {}

  private static List<Object> row(Object... values) {
    var result = new ArrayList<Object>();
    for (Object value : values) result.add(value == null ? "" : value);
    return result;
  }

  private static List<Section> sections(ProcurementAnalyticsView data) {
    var m = data.metadata();
    var f = m.appliedFilters();
    List<List<Object>> metadata = List.of(
        row("口径版本", m.definitionVersion()), row("生成时间", m.createdAt().toString()),
        row("时区", m.timezone()), row("开始日期（含）", f.fromDate().toString()), row("结束日期（含）", f.toDate().toString()),
        row("供应商筛选", f.supplierId() == null ? "全部授权供应商" : f.supplierId()),
        row("订单状态筛选", f.status() == null ? "全部状态" : f.status()), row("数据范围", m.scopeDescription()),
        row("订单金额定义", m.orderAmountBasis()), row("可比报价差额定义", m.quoteDifferenceBasis()),
        row("需求估算边界", m.estimateBoundary()));
    List<List<Object>> summary = List.of(row("订单金额", data.totalSpend()), row("订单数", data.orderCount()),
        row("交易供应商数", data.supplierCount()), row("最高可比报价差额", data.biddingSavings()),
        row("头部供应商订单金额占比(%)", data.topSupplierSharePercent()));
    List<List<Object>> monthly = data.monthlySpend().stream().map(v -> row(v.period(), v.orderCount(), v.totalAmount())).toList();
    List<List<Object>> suppliers = data.supplierSpend().stream().map(v -> row(v.supplierId(), v.supplierName(), v.totalAmount(), v.orderCount(), v.sharePercent())).toList();
    List<List<Object>> statuses = new ArrayList<>(data.statusDistribution().stream().map(v -> row(v.status(), v.orderCount(), v.totalAmount())).toList());
    statuses.add(row("合计", data.orderCount(), data.totalSpend()));
    List<List<Object>> categories = data.categoryDemandEstimate().stream().map(v -> row(v.category(), v.totalAmount())).toList();
    return List.of(new Section("订单状态", List.of("订单状态", "订单数", "订单金额合计"), statuses),
        new Section("定义与筛选", List.of("项目", "定义或实际筛选"), metadata),
        new Section("汇总", List.of("指标", "数值"), summary),
        new Section("月度", List.of("月份", "订单数", "订单金额"), monthly),
        new Section("供应商", List.of("供应商ID", "供应商名称", "订单金额", "订单数", "占比(%)"), suppliers),
        new Section("需求参考金额估算", List.of("需求品类（独立总体）", "当前参考金额估算"), categories));
  }

  public static byte[] toXlsx(ProcurementAnalyticsView data) {
    try (var book = new XSSFWorkbook(); var out = new ByteArrayOutputStream()) {
      var headerStyle = book.createCellStyle();
      var headerFont = book.createFont();
      headerFont.setBold(true);
      headerStyle.setFont(headerFont);
      var moneyStyle = book.createCellStyle();
      moneyStyle.setDataFormat(book.createDataFormat().getFormat("#,##0.00"));
      var integerStyle = book.createCellStyle();
      integerStyle.setDataFormat(book.createDataFormat().getFormat("0"));
      var wrapStyle = book.createCellStyle();
      wrapStyle.setWrapText(true);
      for (var section : sections(data)) {
        var sheet = book.createSheet(section.name());
        sheet.createFreezePane(0, 1);
        var header = sheet.createRow(0);
        for (int c = 0; c < section.headers().size(); c++) {
          var cell = header.createCell(c);
          cell.setCellValue(section.headers().get(c));
          cell.setCellStyle(headerStyle);
          sheet.setColumnWidth(c, section.name().equals("定义与筛选") && c == 1 ? 120 * 256 : 25 * 256);
        }
        for (int r = 0; r < section.rows().size(); r++) {
          var row = sheet.createRow(r + 1);
          var values = section.rows().get(r);
          for (int c = 0; c < values.size(); c++) {
            var cell = row.createCell(c);
            Object value = values.get(c);
            if (value instanceof Number number) {
              cell.setCellValue(number.doubleValue());
              cell.setCellStyle(value instanceof BigDecimal ? moneyStyle : integerStyle);
            } else {
              cell.setCellValue(value.toString());
              cell.setCellStyle(wrapStyle);
            }
          }
          if (section.name().equals("定义与筛选")) row.setHeightInPoints(r >= 8 ? 65 : 32);
        }
      }
      book.write(out);
      return out.toByteArray();
    } catch (Exception error) {
      throw new IllegalStateException("采购分析Excel生成失败", error);
    }
  }

  public static byte[] toPdf(ProcurementAnalyticsView data) {
    var document = new Document(PageSize.A4.rotate(), 28, 28, 28, 28);
    try (var out = new ByteArrayOutputStream()) {
      PdfWriter.getInstance(document, out);
      document.open();
      var base = BaseFont.createFont("STSong-Light", "UniGB-UCS2-H", BaseFont.NOT_EMBEDDED);
      var headingFont = new Font(base, 12, Font.BOLD);
      var bodyFont = new Font(base, 9);
      for (var section : sections(data)) {
        var table = new PdfPTable(section.headers().size());
        table.setWidthPercentage(100);
        if (section.name().equals("定义与筛选")) table.setWidths(new float[]{1, 3});
        var title = new PdfPCell(new Phrase(section.name(), headingFont));
        title.setColspan(section.headers().size());
        title.setBorder(Rectangle.NO_BORDER);
        title.setPaddingTop(12);
        title.setPaddingBottom(6);
        table.addCell(title);
        // Keep each section title with its column headers and repeat both on continuation pages.
        table.setHeaderRows(2);
        for (String header : section.headers()) table.addCell(new Phrase(header, headingFont));
        for (var row : section.rows()) {
          for (Object value : row) {
            String text = value instanceof BigDecimal amount ? amount.toPlainString() : value.toString();
            var cell = new PdfPCell(new Phrase(text, bodyFont));
            cell.setPadding(4);
            table.addCell(cell);
          }
        }
        if (section.rows().isEmpty()) {
          var empty = new PdfPCell(new Phrase("无符合条件的数据", bodyFont));
          empty.setColspan(section.headers().size());
          table.addCell(empty);
        }
        document.add(table);
      }
      document.close();
      return out.toByteArray();
    } catch (Exception error) {
      throw new IllegalStateException("采购分析PDF生成失败", error);
    } finally {
      if (document.isOpen()) document.close();
    }
  }
}
