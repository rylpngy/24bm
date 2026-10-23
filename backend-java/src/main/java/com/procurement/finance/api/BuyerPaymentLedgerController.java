package com.procurement.finance.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.finance.application.PaymentLedgerApplicationService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/buyer/invoices/{invoiceId}/payment-ledger")
public class BuyerPaymentLedgerController {
  private final PaymentLedgerApplicationService service;
  public BuyerPaymentLedgerController(PaymentLedgerApplicationService service) { this.service = service; }

  @GetMapping
  public ApiResponse<PaymentLedgerApplicationService.Summary> summary(@PathVariable String invoiceId) {
    return ApiResponse.ok(service.summary(invoiceId));
  }

  @PostMapping
  public ApiResponse<PaymentLedgerApplicationService.Summary> record(@PathVariable String invoiceId,
      @Valid @RequestBody RecordPaymentAmountRequest request) {
    return ApiResponse.ok(service.record(invoiceId, request));
  }

  @PostMapping("/{entryId}/reverse")
  public ApiResponse<PaymentLedgerApplicationService.Summary> reverse(@PathVariable String invoiceId,
      @PathVariable String entryId, @Valid @RequestBody ReversePaymentRequest request) {
    return ApiResponse.ok(service.reverse(invoiceId, entryId, request));
  }
}
