package com.procurement.ludongpoc.application;

import com.procurement.ludongpoc.api.LudongPocApplicationResponse;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

@Service
public class LudongPocAnalyticsReportService {
  private final LudongPocApplicationService applicationService;

  public LudongPocAnalyticsReportService(LudongPocApplicationService applicationService) {
    this.applicationService = applicationService;
  }

  public byte[] generate(int year, Integer quarter) {
    if (year < 2000 || year > 2100) {
      throw new IllegalArgumentException("报告年度不合法");
    }
    if (quarter != null && (quarter < 1 || quarter > 4)) {
      throw new IllegalArgumentException("季度必须为 1 至 4");
    }
    List<LudongPocApplicationResponse> applications = applicationService.list().stream()
        .filter(application -> inPeriod(application, year, quarter))
        .toList();

    try (XSSFWorkbook workbook = new XSSFWorkbook();
         ByteArrayOutputStream output = new ByteArrayOutputStream()) {
      Styles styles = new Styles(workbook);
      createSummarySheet(workbook, styles, applications, year, quarter);
      createUnitSheet(workbook, styles, applications);
      createCategorySheet(workbook, styles, applications);
      createDetailSheet(workbook, styles, applications);
      workbook.write(output);
      return output.toByteArray();
    } catch (Exception exception) {
      throw new IllegalStateException("无法生成采购申报统计报告", exception);
    }
  }

  private static void createSummarySheet(
      XSSFWorkbook workbook,
      Styles styles,
      List<LudongPocApplicationResponse> applications,
      int year,
      Integer quarter) {
    XSSFSheet sheet = workbook.createSheet("统计摘要");
    sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, 3));
    Cell title = sheet.createRow(0).createCell(0);
    title.setCellValue("鲁东大学采购项目申报" + periodLabel(year, quarter) + "统计报告");
    title.setCellStyle(styles.title);

    BigDecimal totalBudget = applications.stream()
        .map(LudongPocApplicationResponse::budgetAmount)
        .reduce(BigDecimal.ZERO, BigDecimal::add);
    long approved = applications.stream().filter(item -> List.of("approved", "archived").contains(item.status())).count();
    long inApproval = applications.stream().filter(item -> "in_approval".equals(item.status())).count();
    long equipmentCount = applications.stream().flatMap(item -> item.items().stream())
        .mapToLong(item -> decimal(item.get("quantity")).longValue()).sum();

    List<List<Object>> rows = List.of(
        List.of("统计期间", periodLabel(year, quarter), "报告生成时间", OffsetDateTime.now().toString()),
        List.of("申报项目数", applications.size(), "申报预算合计（元）", totalBudget),
        List.of("审批通过项目", approved, "审批中项目", inApproval),
        List.of("设备数量合计", equipmentCount, "平均项目预算（元）",
            applications.isEmpty() ? BigDecimal.ZERO : totalBudget.divide(
                BigDecimal.valueOf(applications.size()), 2, RoundingMode.HALF_UP)));
    writeRows(sheet, styles, 2, rows, true);

    Map<String, Summary> statuses = new LinkedHashMap<>();
    applications.forEach(item -> merge(statuses, statusLabel(item.status()), item.budgetAmount()));
    writeTable(sheet, styles, 7, List.of("流程状态", "项目数", "预算金额（元）"),
        summaries(statuses));
    setWidths(sheet, 24, 20, 24, 24);
  }

  private static void createUnitSheet(
      XSSFWorkbook workbook, Styles styles, List<LudongPocApplicationResponse> applications) {
    Map<String, Summary> units = new LinkedHashMap<>();
    applications.forEach(item -> merge(units, text(item.applicantUnit(), "未设置单位"), item.budgetAmount()));
    List<List<Object>> rows = summaries(units).stream()
        .sorted(Comparator.comparing(row -> decimal(row.get(2)), Comparator.reverseOrder()))
        .toList();
    XSSFSheet sheet = workbook.createSheet("申报单位汇总");
    writeTable(sheet, styles, 0, List.of("申报单位", "项目数", "预算金额（元）"), rows);
    setWidths(sheet, 34, 14, 22);
  }

  private static void createCategorySheet(
      XSSFWorkbook workbook, Styles styles, List<LudongPocApplicationResponse> applications) {
    Map<String, Summary> categories = new LinkedHashMap<>();
    applications.forEach(application -> application.items().forEach(item -> {
      String category = text(item.get("materialCategory"), "未分类");
      merge(categories, category, decimal(item.get("totalPrice")), decimal(item.get("quantity")).longValue());
    }));
    XSSFSheet sheet = workbook.createSheet("设备品类汇总");
    writeTable(sheet, styles, 0, List.of("设备品类", "设备数量", "采购金额（元）"),
        summaries(categories).stream()
            .sorted(Comparator.comparing(row -> decimal(row.get(2)), Comparator.reverseOrder()))
            .toList());
    setWidths(sheet, 34, 14, 22);
  }

  private static void createDetailSheet(
      XSSFWorkbook workbook, Styles styles, List<LudongPocApplicationResponse> applications) {
    XSSFSheet sheet = workbook.createSheet("项目明细");
    List<List<Object>> rows = new ArrayList<>();
    applications.forEach(item -> rows.add(List.of(
        item.applicationNo(), item.projectName(), item.applicantUnit(), item.budgetAmount(),
        statusLabel(item.status()), item.items().size(),
        text(item.formData().get("fundingSource"), "未填写"),
        text(item.formData().get("procurementMethod"), "待确定"),
        item.submittedAt() == null ? item.createdAt().toString() : item.submittedAt().toString(),
        item.approvedAt() == null ? "" : item.approvedAt().toString())));
    writeTable(sheet, styles, 0, List.of(
        "申报编号", "项目名称", "申报单位", "预算金额（元）", "状态", "明细行数",
        "经费来源", "采购方式", "申报时间", "通过时间"), rows);
    setWidths(sheet, 24, 34, 28, 18, 14, 14, 24, 18, 24, 24);
  }

  private static boolean inPeriod(LudongPocApplicationResponse item, int year, Integer quarter) {
    OffsetDateTime date = item.submittedAt() == null ? item.createdAt() : item.submittedAt();
    if (date.getYear() != year) return false;
    return quarter == null || (date.getMonthValue() - 1) / 3 + 1 == quarter;
  }

  private static String periodLabel(int year, Integer quarter) {
    return year + "年" + (quarter == null ? "度" : "第" + quarter + "季度");
  }

  private static String statusLabel(String status) {
    return switch (status) {
      case "draft" -> "草稿";
      case "in_approval" -> "审批中";
      case "approved" -> "已通过";
      case "rejected" -> "已驳回";
      case "archived" -> "已归档";
      default -> status;
    };
  }

  private static void merge(Map<String, Summary> map, String name, BigDecimal amount) {
    merge(map, name, amount, 1);
  }

  private static void merge(Map<String, Summary> map, String name, BigDecimal amount, long count) {
    map.merge(name, new Summary(count, amount),
        (left, right) -> new Summary(left.count + right.count, left.amount.add(right.amount)));
  }

  private static List<List<Object>> summaries(Map<String, Summary> values) {
    return values.entrySet().stream().map(entry -> List.<Object>of(
        entry.getKey(), entry.getValue().count, entry.getValue().amount)).toList();
  }

  private static void writeTable(
      XSSFSheet sheet, Styles styles, int startRow, List<String> headers, List<List<Object>> rows) {
    Row header = sheet.createRow(startRow);
    for (int column = 0; column < headers.size(); column++) {
      Cell cell = header.createCell(column);
      cell.setCellValue(headers.get(column));
      cell.setCellStyle(styles.header);
    }
    writeRows(sheet, styles, startRow + 1, rows, false);
    sheet.createFreezePane(0, startRow + 1);
    sheet.setAutoFilter(new CellRangeAddress(startRow, startRow + rows.size(), 0, headers.size() - 1));
  }

  private static void writeRows(
      XSSFSheet sheet, Styles styles, int startRow, List<List<Object>> rows, boolean labelColumns) {
    for (int index = 0; index < rows.size(); index++) {
      Row row = sheet.createRow(startRow + index);
      List<Object> values = rows.get(index);
      for (int column = 0; column < values.size(); column++) {
        Cell cell = row.createCell(column);
        Object value = values.get(column);
        if (value instanceof Number number) cell.setCellValue(number.doubleValue());
        else cell.setCellValue(value == null ? "" : value.toString());
        cell.setCellStyle(labelColumns && column % 2 == 0 ? styles.label : styles.body);
      }
    }
  }

  private static void setWidths(XSSFSheet sheet, int... widths) {
    for (int index = 0; index < widths.length; index++) {
      sheet.setColumnWidth(index, widths[index] * 256);
    }
  }

  private static String text(Object value, String fallback) {
    return value == null || value.toString().isBlank() ? fallback : value.toString();
  }

  private static BigDecimal decimal(Object value) {
    if (value == null || value.toString().isBlank()) return BigDecimal.ZERO;
    try {
      return new BigDecimal(value.toString().replace(",", ""));
    } catch (NumberFormatException ignored) {
      return BigDecimal.ZERO;
    }
  }

  private record Summary(long count, BigDecimal amount) {}

  private static final class Styles {
    private final CellStyle title;
    private final CellStyle header;
    private final CellStyle label;
    private final CellStyle body;

    private Styles(XSSFWorkbook workbook) {
      title = workbook.createCellStyle();
      var titleFont = workbook.createFont();
      titleFont.setBold(true);
      titleFont.setFontHeightInPoints((short) 16);
      title.setFont(titleFont);
      title.setAlignment(HorizontalAlignment.CENTER);
      title.setVerticalAlignment(VerticalAlignment.CENTER);

      header = workbook.createCellStyle();
      var headerFont = workbook.createFont();
      headerFont.setBold(true);
      headerFont.setColor(IndexedColors.WHITE.getIndex());
      header.setFont(headerFont);
      header.setFillForegroundColor(IndexedColors.DARK_BLUE.getIndex());
      header.setFillPattern(FillPatternType.SOLID_FOREGROUND);
      header.setAlignment(HorizontalAlignment.CENTER);
      border(header);

      label = workbook.createCellStyle();
      var labelFont = workbook.createFont();
      labelFont.setBold(true);
      label.setFont(labelFont);
      label.setFillForegroundColor(IndexedColors.GREY_25_PERCENT.getIndex());
      label.setFillPattern(FillPatternType.SOLID_FOREGROUND);
      border(label);

      body = workbook.createCellStyle();
      border(body);
    }

    private static void border(CellStyle style) {
      style.setBorderTop(BorderStyle.THIN);
      style.setBorderRight(BorderStyle.THIN);
      style.setBorderBottom(BorderStyle.THIN);
      style.setBorderLeft(BorderStyle.THIN);
      style.setVerticalAlignment(VerticalAlignment.CENTER);
    }
  }
}
