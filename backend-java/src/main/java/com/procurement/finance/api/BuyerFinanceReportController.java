package com.procurement.finance.api;

import com.procurement.finance.application.FinanceReportApplicationService;
import java.nio.charset.StandardCharsets;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@io.swagger.v3.oas.annotations.tags.Tag(name = "buyer-finance-action-controller")
@RequestMapping("/api/v1/buyer")
public class BuyerFinanceReportController {
  private final FinanceReportApplicationService financeReportApplicationService;

  public BuyerFinanceReportController(FinanceReportApplicationService financeReportApplicationService) {
    this.financeReportApplicationService = financeReportApplicationService;
  }

  // ====== 报表导出(format=xlsx|pdf,默认 xlsx)======

  @GetMapping("/reports/invoices")
  @io.swagger.v3.oas.annotations.Operation(operationId = "BuyerFinanceAction_exportInvoices")
  public ResponseEntity<ByteArrayResource> exportInvoices(
      @RequestParam(required = false, defaultValue = "xlsx") String format) {
    return download(financeReportApplicationService.exportInvoices(format));
  }

  @GetMapping("/reports/reconciliation")
  @io.swagger.v3.oas.annotations.Operation(operationId = "BuyerFinanceAction_exportReconciliation")
  public ResponseEntity<ByteArrayResource> exportReconciliation(
      @RequestParam(required = false, defaultValue = "xlsx") String format) {
    return download(financeReportApplicationService.exportReconciliation(format));
  }

  @GetMapping("/reports/procurement-analytics")
  @io.swagger.v3.oas.annotations.Operation(operationId = "BuyerFinanceAction_exportProcurementAnalytics")
  public ResponseEntity<ByteArrayResource> exportProcurementAnalytics(
      @RequestParam(required = false, defaultValue = "xlsx") String format) {
    return download(financeReportApplicationService.exportProcurementAnalytics(format));
  }

  private ResponseEntity<ByteArrayResource> download(
      com.procurement.finance.api.FinanceReport report) {
    HttpHeaders headers = new HttpHeaders();
    headers.setContentDisposition(
        ContentDisposition.attachment()
            .filename(report.filename(), StandardCharsets.UTF_8)
            .build());
    return ResponseEntity.ok()
        .headers(headers)
        .contentType(MediaType.parseMediaType(report.contentType()))
        .contentLength(report.content().length)
        .body(new ByteArrayResource(report.content()));
  }
}
