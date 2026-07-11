package com.procurement.common.excel;

import java.nio.charset.StandardCharsets;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

// xlsx 附件下载响应(中文文件名 UTF-8 编码)。
public final class ExcelDownloads {

  private static final String XLSX_CONTENT_TYPE =
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  private ExcelDownloads() {}

  public static ResponseEntity<ByteArrayResource> xlsx(String filename, byte[] content) {
    HttpHeaders headers = new HttpHeaders();
    headers.setContentDisposition(
        ContentDisposition.attachment().filename(filename, StandardCharsets.UTF_8).build());
    return ResponseEntity.ok()
        .headers(headers)
        .contentType(MediaType.parseMediaType(XLSX_CONTENT_TYPE))
        .contentLength(content.length)
        .body(new ByteArrayResource(content));
  }
}
