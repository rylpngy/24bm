package com.procurement.sourcing.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.TreeMap;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

public final class ProcurementExecutionArchiveWriter {
  private ProcurementExecutionArchiveWriter() {}

  public static String sha256(byte[] data) {
    try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(data)); }
    catch (java.security.NoSuchAlgorithmException error) { throw new IllegalStateException(error); }
  }
  public static String hash(JsonNode value) { return sha256(canonical(value).toString().getBytes(StandardCharsets.UTF_8)); }

  /** GET tracks metadata changes, not object-store integrity. Observed bytes are only verified on archive/download. */
  public static String stateHash(JsonNode value) {
    JsonNode state=value.deepCopy();
    for (var attachment : state.path("attachments")) if (attachment instanceof com.fasterxml.jackson.databind.node.ObjectNode object) {
      object.remove(java.util.List.of("size","sha256"));
    }
    return hash(state);
  }

  private static JsonNode canonical(JsonNode node) {
    if (node.isObject()) {
      var sorted = new TreeMap<String,JsonNode>(); node.fields().forEachRemaining(e -> sorted.put(e.getKey(),e.getValue()));
      var out = JsonNodeFactory.instance.objectNode(); sorted.forEach((k,v) -> out.set(k,canonical(v))); return out;
    }
    if (node.isArray()) { var out=JsonNodeFactory.instance.arrayNode(); node.forEach(n -> out.add(canonical(n))); return out; }
    if (node.isNumber()) return JsonNodeFactory.instance.numberNode(node.decimalValue().stripTrailingZeros());
    return node;
  }

  public static String attachmentPath(int index,String fileName) {
    String clean = fileName == null ? "attachment" : fileName.replaceAll("[\\\\/\\p{Cntrl}:*?\"<>|]","_").replace("..","_");
    if (clean.isBlank()) clean="attachment";
    if (clean.length()>100) clean=clean.substring(clean.length()-100);
    return "附件/%03d-%s".formatted(index,clean);
  }

  public static byte[] write(JsonNode snapshot,Map<String,byte[]> attachments,ObjectMapper json) {
    try {
      Map<String,byte[]> files = new LinkedHashMap<>();
      files.put("台账.xlsx",workbook(snapshot));
      files.put("业务快照.json",json.writerWithDefaultPrettyPrinter().writeValueAsBytes(snapshot));
      var history = json.createObjectNode(); history.set("workflowHistory",snapshot.path("workflowHistory"));
      history.set("legacyApprovals",snapshot.path("legacyApprovals"));
      history.set("dispositionReviews",snapshot.path("dispositionReviews"));
      history.set("afterSalesHistory",snapshot.path("afterSalesHistory"));
      history.set("physicalAfterSales",snapshot.path("physicalAfterSales"));
      history.set("qualityResolutions",snapshot.path("qualityResolutions"));
      files.put("审核历史.json",json.writerWithDefaultPrettyPrinter().writeValueAsBytes(history));
      attachments.forEach((path,bytes) -> {
        if (!path.startsWith("附件/") || path.contains("..") || path.contains("\\") || files.putIfAbsent(path,bytes) != null)
          throw new IllegalArgumentException("Unsafe or duplicate archive entry");
      });
      StringBuilder sums = new StringBuilder(); files.forEach((path,bytes) -> sums.append(sha256(bytes)).append("  ").append(path).append('\n'));
      files.put("SHA256SUMS.txt",sums.toString().getBytes(StandardCharsets.UTF_8));
      try (var out = new ByteArrayOutputStream(); var zip = new ZipOutputStream(out,StandardCharsets.UTF_8)) {
        for (var entry : files.entrySet()) {
          var ze = new ZipEntry(entry.getKey()); ze.setTime(0); zip.putNextEntry(ze); zip.write(entry.getValue()); zip.closeEntry();
        }
        zip.finish(); return out.toByteArray();
      }
    } catch (java.io.IOException error) { throw new IllegalStateException("Cannot build procurement archive",error); }
  }

  private static byte[] workbook(JsonNode snapshot) throws java.io.IOException {
    try (var book = new XSSFWorkbook(); var out = new ByteArrayOutputStream()) {
      var sheet = book.createSheet("采购执行台账");
      var header = sheet.createRow(0); String[] names={"业务模块","单据编号","业务名称","状态","金额","关联记录"};
      var style = book.createCellStyle(); var font = book.createFont(); font.setBold(true); style.setFont(font);
      for (int i=0;i<names.length;i++) { var cell=header.createCell(i); cell.setCellValue(names[i]); cell.setCellStyle(style); }
      int row=1;
      var evaluation=ProcurementExecutionPolicy.evaluate(snapshot);
      for (var doc : evaluation.documents()) {
        var cells=sheet.createRow(row++);
        cells.createCell(0).setCellValue(switch(doc.module()) {
          case "demands" -> "采购需求"; case "rfqs" -> "询价定标"; case "orders" -> "采购订单";
          case "contracts" -> "合同"; case "receipts" -> "收货验收"; default -> "发票付款";
        });
        cells.createCell(1).setCellValue(doc.id()); cells.createCell(2).setCellValue(doc.label());
        cells.createCell(3).setCellValue(doc.status());
        if (doc.amount()!=null) cells.createCell(4).setCellValue(doc.amount().toPlainString());
        cells.createCell(5).setCellValue(doc.recordId());
      }
      sheet.createFreezePane(0,1); for(int i=0;i<names.length;i++) sheet.setColumnWidth(i,(i==2?48:24)*256);
      var totals=book.createSheet("金额汇总");
      String[] labels={"需求预算","订单金额","有效开票","已知付款净额","剩余应付"};
      java.math.BigDecimal[] values={evaluation.budgetAmount(),evaluation.orderAmount(),evaluation.invoicedAmount(),evaluation.paidAmount(),evaluation.remainingAmount()};
      for(int i=0;i<labels.length;i++) { var r=totals.createRow(i); r.createCell(0).setCellValue(labels[i]); r.createCell(1).setCellValue(values[i]==null?"未知":values[i].toPlainString()); }
      totals.setColumnWidth(0,24*256); totals.setColumnWidth(1,24*256);
      book.write(out); return out.toByteArray();
    }
  }
}
