package com.procurement.common.excel;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.List;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

// Excel 基础数据导入的通用读写:首个工作表按字符串矩阵读取;模板 = 表头 + 示例行。
public final class ExcelSheets {

  private ExcelSheets() {}

  /** 读取首个工作表为字符串矩阵(含表头行);单元格统一 DataFormatter 文本化并 trim。 */
  public static List<List<String>> readFirstSheet(byte[] content, int maxRows) {
    DataFormatter formatter = new DataFormatter();
    try (XSSFWorkbook workbook = new XSSFWorkbook(new ByteArrayInputStream(content))) {
      if (workbook.getNumberOfSheets() == 0) {
        throw new IllegalArgumentException("Excel 文件中没有工作表");
      }
      XSSFSheet sheet = workbook.getSheetAt(0);
      if (sheet.getLastRowNum() + 1 > maxRows) {
        throw new IllegalArgumentException("单次导入最多 " + maxRows + " 行(含表头),请拆分文件");
      }
      List<List<String>> rows = new ArrayList<>();
      int lastColumn = 0;
      Row headerRow = sheet.getRow(0);
      if (headerRow != null) {
        lastColumn = headerRow.getLastCellNum();
      }
      for (int r = 0; r <= sheet.getLastRowNum(); r++) {
        Row row = sheet.getRow(r);
        List<String> cells = new ArrayList<>();
        int columnCount = Math.max(lastColumn, row == null ? 0 : row.getLastCellNum());
        for (int c = 0; c < columnCount; c++) {
          Cell cell = row == null ? null : row.getCell(c);
          cells.add(cell == null ? "" : formatter.formatCellValue(cell).strip());
        }
        rows.add(cells);
      }
      return rows;
    } catch (IOException exception) {
      throw new IllegalArgumentException("无法解析 Excel 文件,请使用模板另存为 .xlsx 后重试", exception);
    }
  }

  /** 生成导入模板:加粗灰底表头 + 示例数据行。 */
  public static byte[] template(String sheetName, List<String> headers, List<List<String>> exampleRows) {
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
        sheet.setColumnWidth(c, 20 * 256);
      }
      for (int r = 0; r < exampleRows.size(); r++) {
        Row row = sheet.createRow(r + 1);
        List<String> cells = exampleRows.get(r);
        for (int c = 0; c < cells.size(); c++) {
          row.createCell(c).setCellValue(cells.get(c));
        }
      }
      workbook.write(out);
      return out.toByteArray();
    } catch (IOException exception) {
      throw new UncheckedIOException(exception);
    }
  }
}
