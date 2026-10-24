package com.procurement;

import static org.assertj.core.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.sourcing.application.ProcurementExecutionArchiveWriter;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.zip.ZipInputStream;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;

class ProcurementExecutionArchiveTests {
  private final ObjectMapper json = new ObjectMapper();

  @Test void canonicalHashIgnoresObjectPropertyOrderButNotBusinessChanges() throws Exception {
    assertThat(ProcurementExecutionArchiveWriter.hash(json.readTree("{\"b\":2,\"a\":1}")))
        .isEqualTo(ProcurementExecutionArchiveWriter.hash(json.readTree("{\"a\":1,\"b\":2}")))
        .isNotEqualTo(ProcurementExecutionArchiveWriter.hash(json.readTree("{\"a\":2,\"b\":2}")));
  }

  @Test void zipHasReadableWorkbookSnapshotHistoryOriginalAndChecksums() throws Exception {
    var data = new ProcurementExecutionPolicyTests().complete();
    byte[] original = "原始附件".getBytes(StandardCharsets.UTF_8);
    byte[] zip = ProcurementExecutionArchiveWriter.write(data, Map.of("附件/001-safe.txt",original),json);
    Map<String,byte[]> entries = unzip(zip);
    assertThat(entries.keySet()).contains("台账.xlsx","业务快照.json","审核历史.json","SHA256SUMS.txt","附件/001-safe.txt");
    assertThat(entries.get("附件/001-safe.txt")).isEqualTo(original);
    assertThat(new String(entries.get("业务快照.json"),StandardCharsets.UTF_8)).doesNotContain("storageKey");
    try (var workbook = new XSSFWorkbook(new ByteArrayInputStream(entries.get("台账.xlsx")))) {
      assertThat(workbook.getSheetAt(0).getRow(0).getCell(0).getStringCellValue()).isEqualTo("业务模块");
      assertThat(workbook.getSheetAt(0).getLastRowNum()).isGreaterThan(3);
    }
    String sums = new String(entries.get("SHA256SUMS.txt"),StandardCharsets.UTF_8);
    entries.forEach((name, bytes) -> {
      if (!name.equals("SHA256SUMS.txt")) assertThat(sums).contains(ProcurementExecutionArchiveWriter.sha256(bytes) + "  " + name);
    });
  }

  @Test void fileNamesCannotTraverseOrCollide() {
    assertThat(ProcurementExecutionArchiveWriter.attachmentPath(1,"../../a\\b\n.xlsx"))
        .doesNotContain("..","\\","\n").startsWith("附件/001-");
    assertThat(ProcurementExecutionArchiveWriter.attachmentPath(2,"same.txt"))
        .isNotEqualTo(ProcurementExecutionArchiveWriter.attachmentPath(1,"same.txt"));
  }

  static Map<String,byte[]> unzip(byte[] bytes) throws Exception {
    Map<String,byte[]> out = new LinkedHashMap<>();
    try (var zip = new ZipInputStream(new ByteArrayInputStream(bytes),StandardCharsets.UTF_8)) {
      for (var entry = zip.getNextEntry(); entry != null; entry = zip.getNextEntry()) out.put(entry.getName(),zip.readAllBytes());
    }
    return out;
  }
}
