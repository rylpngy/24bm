package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyExecutionRecords.*;
import java.io.*;
import java.nio.*;
import java.nio.charset.*;
import java.util.*;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Component;

@Component
public class AgencyParticipationImportParser {
  public static final List<String> HEADERS =
      List.of(
          "供应商名称", "统一社会信用代码", "联系人", "联系电话", "记录来源", "文件获取情况", "响应递交情况", "待核实事项", "风险复核情况", "备注");

  private record Raw(int row, List<String> values, List<String> errors, List<String> warnings) {}

  public List<ParticipationImportRow> parse(String name, byte[] bytes) {
    if (bytes.length == 0 || bytes.length > 2 * 1024 * 1024)
      throw new IllegalArgumentException("批量台账文件须大于0且不超过2MB");
    List<Raw> raw;
    if (name.toLowerCase(Locale.ROOT).endsWith(".csv")) raw = csv(bytes);
    else if (name.toLowerCase(Locale.ROOT).endsWith(".xlsx")) raw = xlsx(bytes);
    else throw new IllegalArgumentException("批量台账仅支持UTF-8 CSV或XLSX");
    if (raw.isEmpty()) throw new IllegalArgumentException("文件缺少表头和数据");
    var header = new ArrayList<>(raw.getFirst().values().stream().map(String::strip).toList());
    while (!header.isEmpty() && header.getLast().isBlank()) header.removeLast();
    if (!raw.getFirst().errors().isEmpty()
        || header.isEmpty()
        || header.size() > HEADERS.size()
        || header.stream().anyMatch(h -> !HEADERS.contains(h))
        || new HashSet<>(header).size() != header.size()
        || !header.contains("供应商名称"))
      throw new IllegalArgumentException("表头须使用导入模板，至少包含供应商名称，不允许重复或未知列");
    List<ParticipationImportRow> out = new ArrayList<>();
    for (var row : raw.subList(1, raw.size())) {
      if (row.values().stream().allMatch(String::isBlank) && row.errors().isEmpty()) continue;
      if (out.size() >= 200) throw new IllegalArgumentException("每批最多200条台账记录");
      var errors = new ArrayList<>(row.errors());
      var warnings = new ArrayList<>(row.warnings());
      var data = new HashMap<String, String>();
      for (int i = 0; i < header.size(); i++)
        data.put(header.get(i), i < row.values().size() ? row.values().get(i).strip() : "");
      if (row.values().size() > header.size()
          && row.values().subList(header.size(), row.values().size()).stream()
              .anyMatch(v -> !v.isBlank())) errors.add("数据列超出表头范围");
      for (var entry : data.entrySet())
        if (entry.getValue().length() > 4000) errors.add(entry.getKey() + "超过4000字符");
      for (var entry : data.entrySet())
        if (entry.getValue().startsWith("=") || entry.getValue().startsWith("@"))
          errors.add(entry.getKey() + "包含疑似公式，请改成普通文本后重新预览");
      String supplier = data.getOrDefault("供应商名称", "");
      if (supplier.isBlank() || supplier.length() > 300) errors.add("供应商名称必填且不超过300字符");
      String source = data.getOrDefault("记录来源", "");
      if (source.isBlank()) source = "批量导入：" + name + "，记录" + row.row();
      if (source.length() > 1000) errors.add("记录来源超过1000字符");
      String acquisition =
          status(
              data.get("文件获取情况"),
              Map.of("待核对", "unknown", "已获取", "acquired", "不适用", "not_applicable"),
              List.of("unknown", "acquired", "not_applicable"),
              "unknown",
              "文件获取情况",
              errors);
      String submission =
          status(
              data.get("响应递交情况"),
              Map.of("待核对", "unknown", "已提交", "submitted", "已递交", "submitted", "已撤回", "withdrawn"),
              List.of("unknown", "submitted", "withdrawn"),
              "unknown",
              "响应递交情况",
              errors);
      String risk =
          status(
              data.get("风险复核情况"),
              Map.of(
                  "待核实",
                  "pending",
                  "待复核",
                  "pending",
                  "已核实",
                  "checked",
                  "已复核",
                  "checked",
                  "不适用",
                  "not_applicable"),
              List.of("pending", "checked", "not_applicable"),
              "pending",
              "风险复核情况",
              errors);
      var draft =
          new ParticipationDraft(
              null,
              supplier,
              data.getOrDefault("统一社会信用代码", ""),
              data.getOrDefault("联系人", ""),
              data.getOrDefault("联系电话", ""),
              source,
              acquisition,
              submission,
              data.getOrDefault("待核实事项", ""),
              risk,
              null,
              data.getOrDefault("备注", ""));
      out.add(new ParticipationImportRow(row.row(), draft, errors, warnings));
    }
    if (out.isEmpty()) throw new IllegalArgumentException("文件没有可预览的台账记录");
    return out;
  }

  private String status(
      String value,
      Map<String, String> labels,
      List<String> codes,
      String fallback,
      String field,
      List<String> errors) {
    if (value == null || value.isBlank()) return fallback;
    String result = labels.getOrDefault(value, value);
    if (!codes.contains(result)) {
      errors.add(field + "不合法；台账不接受准入或资格结论");
      return fallback;
    }
    return result;
  }

  private List<Raw> csv(byte[] bytes) {
    String text;
    try {
      text =
          StandardCharsets.UTF_8
              .newDecoder()
              .onMalformedInput(CodingErrorAction.REPORT)
              .decode(ByteBuffer.wrap(bytes))
              .toString();
    } catch (CharacterCodingException e) {
      throw new IllegalArgumentException("CSV须使用UTF-8编码");
    }
    if (text.startsWith("\uFEFF")) text = text.substring(1);
    List<Raw> out = new ArrayList<>();
    List<String> cells = new ArrayList<>();
    StringBuilder cell = new StringBuilder();
    boolean quoted = false, closed = false;
    int record = 1;
    for (int i = 0; i < text.length(); i++) {
      char c = text.charAt(i);
      if (quoted) {
        if (c == '"') {
          if (i + 1 < text.length() && text.charAt(i + 1) == '"') {
            cell.append('"');
            i++;
          } else {
            quoted = false;
            closed = true;
          }
        } else cell.append(c);
      } else if (c == '"') {
        if (cell.length() != 0 || closed)
          throw new IllegalArgumentException("CSV引号格式错误，记录" + record);
        quoted = true;
      } else if (c == ',' || c == '\n' || c == '\r') {
        cells.add(cell.toString());
        cell.setLength(0);
        closed = false;
        if (c != ',') {
          out.add(new Raw(record++, List.copyOf(cells), List.of(), List.of()));
          cells.clear();
          if (c == '\r' && i + 1 < text.length() && text.charAt(i + 1) == '\n') i++;
        }
      } else {
        if (closed && !Character.isWhitespace(c))
          throw new IllegalArgumentException("CSV引号后存在非法内容，记录" + record);
        if (!closed) cell.append(c);
      }
      if (cell.length() > 8000 || cells.size() > 15 || out.size() > 1000)
        throw new IllegalArgumentException("CSV单元格、列数或空白记录过多，请整理文件后再导入");
    }
    if (quoted) throw new IllegalArgumentException("CSV引号未闭合");
    if (cell.length() > 0 || !cells.isEmpty() || closed) {
      cells.add(cell.toString());
      out.add(new Raw(record, cells, List.of(), List.of()));
    }
    return out;
  }

  private List<Raw> xlsx(byte[] bytes) {
    try (var workbook = new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
      if (workbook.getNumberOfSheets() == 0 || !workbook.getExternalLinksTable().isEmpty())
        throw new IllegalArgumentException("XLSX须包含工作表且不能有外部工作簿链接");
      for (int i = 1; i < workbook.getNumberOfSheets(); i++)
        if (workbook.getSheetAt(i).getPhysicalNumberOfRows() > 0)
          throw new IllegalArgumentException("一次只支持一个有数据的工作表");
      List<Raw> out = new ArrayList<>();
      var formatter = new DataFormatter(Locale.ROOT);
      for (var row : workbook.getSheetAt(0)) {
        if (out.size() >= 1000 || row.getLastCellNum() > 15)
          throw new IllegalArgumentException("XLSX格式行或列过多，请另存为仅含数据的工作表");
        var values = new ArrayList<String>();
        var errors = new ArrayList<String>();
        var warnings = new ArrayList<String>();
        for (int i = 0; i < Math.max(0, row.getLastCellNum()); i++) {
          var c = row.getCell(i);
          if (c != null && c.getCellType() == CellType.FORMULA) {
            errors.add("第" + (i + 1) + "列包含公式，请改成纯文本或数值；系统不会计算公式");
            values.add("");
          } else {
            values.add(c == null ? "" : formatter.formatCellValue(c));
            if (c != null && c.getCellType() == CellType.NUMERIC)
              warnings.add("第" + (i + 1) + "列是数字单元格，请核对前导零及数值精度");
          }
        }
        out.add(new Raw(row.getRowNum() + 1, values, errors, warnings));
      }
      return out;
    } catch (IllegalArgumentException e) {
      throw e;
    } catch (Exception e) {
      throw new IllegalArgumentException("XLSX无法读取，请检查文件格式");
    }
  }
}
