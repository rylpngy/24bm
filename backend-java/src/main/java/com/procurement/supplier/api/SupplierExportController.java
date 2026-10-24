package com.procurement.supplier.api;

import com.procurement.supplier.application.SupplierExportService;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/buyer/suppliers")
public class SupplierExportController {
  private final SupplierExportService service;

  public SupplierExportController(SupplierExportService service) {
    this.service = service;
  }

  @GetMapping("/export")
  public ResponseEntity<byte[]> export(@RequestParam String kind,
      @RequestParam(required = false) String period) {
    var result = service.export(kind, period);
    String encoded = URLEncoder.encode(result.fileName(), StandardCharsets.UTF_8).replace("+", "%20");
    return ResponseEntity.ok()
        .contentType(MediaType.parseMediaType(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encoded)
        .header(HttpHeaders.CACHE_CONTROL, "no-store")
        .body(result.content());
  }
}
