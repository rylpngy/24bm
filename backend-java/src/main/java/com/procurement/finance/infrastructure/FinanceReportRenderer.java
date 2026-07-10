package com.procurement.finance.infrastructure;

import com.lowagie.text.Document;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.BaseFont;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.UncheckedIOException;
import java.util.List;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

// 报表渲染:通用「标题 + 表头 + 行」结构 → Excel(.xlsx)/ PDF(含中文)字节流。
public final class FinanceReportRenderer {

  private FinanceReportRenderer() {}

  public static byte[] toXlsx(String sheetName, List<String> headers, List<List<String>> rows) {
    try (XSSFWorkbook workbook = new XSSFWorkbook();
        ByteArrayOutputStream out = new ByteArrayOutputStream()) {
      XSSFSheet sheet = workbook.createSheet(sheetName);

      CellStyle headerStyle = workbook.createCellStyle();
      var font = workbook.createFont();
      font.setBold(true);
      headerStyle.setFont(font);
      headerStyle.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
      headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

      Row headerRow = sheet.createRow(0);
      for (int c = 0; c < headers.size(); c++) {
        Cell cell = headerRow.createCell(c);
        cell.setCellValue(headers.get(c));
        cell.setCellStyle(headerStyle);
      }
      for (int r = 0; r < rows.size(); r++) {
        Row row = sheet.createRow(r + 1);
        List<String> cells = rows.get(r);
        for (int c = 0; c < cells.size(); c++) {
          row.createCell(c).setCellValue(cells.get(c) == null ? "" : cells.get(c));
        }
      }
      for (int c = 0; c < headers.size(); c++) {
        sheet.autoSizeColumn(c);
      }
      workbook.write(out);
      return out.toByteArray();
    } catch (Exception exception) {
      throw new UncheckedIOException(new java.io.IOException("Failed to render xlsx", exception));
    }
  }

  public static byte[] toPdf(String title, List<String> headers, List<List<String>> rows) {
    Document document = new Document(PageSize.A4.rotate(), 28, 28, 28, 28);
    try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
      PdfWriter.getInstance(document, out);
      document.open();
      // 内置中日韩字体(openpdf-fonts-extra 提供 CMap),保证中文正常渲染。
      BaseFont cjk = BaseFont.createFont("STSong-Light", "UniGB-UCS2-H", BaseFont.NOT_EMBEDDED);
      Font titleFont = new Font(cjk, 14, Font.BOLD);
      Font headerFont = new Font(cjk, 9, Font.BOLD, Color.WHITE);
      Font cellFont = new Font(cjk, 9);

      Paragraph heading = new Paragraph(title, titleFont);
      heading.setSpacingAfter(10);
      document.add(heading);

      PdfPTable table = new PdfPTable(headers.size());
      table.setWidthPercentage(100);
      for (String header : headers) {
        PdfPCell cell = new PdfPCell(new Phrase(header, headerFont));
        cell.setBackgroundColor(new Color(51, 65, 85));
        cell.setPadding(5);
        table.addCell(cell);
      }
      for (List<String> row : rows) {
        for (String value : row) {
          PdfPCell cell = new PdfPCell(new Phrase(value == null ? "" : value, cellFont));
          cell.setPadding(4);
          cell.setHorizontalAlignment(Element.ALIGN_LEFT);
          table.addCell(cell);
        }
      }
      document.add(table);
      document.close();
      return out.toByteArray();
    } catch (Exception exception) {
      throw new UncheckedIOException(new java.io.IOException("Failed to render pdf", exception));
    }
  }
}
