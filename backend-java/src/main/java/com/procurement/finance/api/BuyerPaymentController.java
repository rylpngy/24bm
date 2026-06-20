package com.procurement.finance.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.audit.api.AuditLogResponse;
import com.procurement.finance.application.PaymentApplicationService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/buyer/invoices")
public class BuyerPaymentController {
  private final PaymentApplicationService paymentApplicationService;

  public BuyerPaymentController(PaymentApplicationService paymentApplicationService) {
    this.paymentApplicationService = paymentApplicationService;
  }

  @GetMapping
  public ApiResponse<List<InvoiceResponse>> list(
      @RequestParam(required = false) String paymentStatus,
      @RequestParam(required = false) String supplierId,
      @RequestParam(required = false) String orderId) {
    return ApiResponse.ok(paymentApplicationService.listCurrentTenantInvoices(paymentStatus, supplierId, orderId));
  }

  @PostMapping("/{invoiceId}/payments")
  public ApiResponse<InvoiceResponse> register(@PathVariable String invoiceId, @Valid @RequestBody RegisterPaymentRequest request) {
    return ApiResponse.ok(paymentApplicationService.register(invoiceId, request));
  }

  @PutMapping("/{invoiceId}")
  public ApiResponse<InvoiceResponse> update(@PathVariable String invoiceId, @Valid @RequestBody UpdateInvoicePaymentRequest request) {
    return ApiResponse.ok(paymentApplicationService.update(invoiceId, request));
  }

  @GetMapping("/{invoiceId}/payment-audit-logs")
  public ApiResponse<List<AuditLogResponse>> paymentAuditLogs(@PathVariable String invoiceId) {
    return ApiResponse.ok(paymentApplicationService.listCurrentTenantPaymentAuditLogs(invoiceId));
  }
}
