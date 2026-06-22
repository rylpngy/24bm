package com.procurement.finance.api;

import com.procurement.audit.api.AuditLogResponse;
import com.procurement.common.api.ApiResponse;
import com.procurement.finance.application.InvoiceApplicationService;
import java.util.List;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/supplier/invoices")
public class SupplierReceivableController {
  private final InvoiceApplicationService invoiceApplicationService;

  public SupplierReceivableController(InvoiceApplicationService invoiceApplicationService) {
    this.invoiceApplicationService = invoiceApplicationService;
  }

  @GetMapping
  public ApiResponse<List<InvoiceResponse>> list(
      @RequestParam(required = false) String paymentStatus,
      @RequestParam(required = false) String orderId) {
    return ApiResponse.ok(invoiceApplicationService.listCurrentSupplierInvoices(paymentStatus, orderId));
  }

  @GetMapping("/{invoiceId}/payment-audit-logs")
  public ApiResponse<List<AuditLogResponse>> paymentAuditLogs(@PathVariable String invoiceId) {
    return ApiResponse.ok(invoiceApplicationService.listCurrentSupplierPaymentAuditLogs(invoiceId));
  }

  @PutMapping("/{invoiceId}/reconciliation")
  public ApiResponse<InvoiceResponse> updateReceivable(
      @PathVariable String invoiceId,
      @Valid @RequestBody UpdateSupplierReceivableRequest request) {
    return ApiResponse.ok(invoiceApplicationService.updateReceivable(invoiceId, request));
  }
}
