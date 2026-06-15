package com.procurement.finance.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.finance.application.PaymentApplicationService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/buyer/invoices")
public class BuyerPaymentController {
  private final PaymentApplicationService paymentApplicationService;

  public BuyerPaymentController(PaymentApplicationService paymentApplicationService) {
    this.paymentApplicationService = paymentApplicationService;
  }

  @GetMapping
  public ApiResponse<List<InvoiceResponse>> list() {
    return ApiResponse.ok(paymentApplicationService.listCurrentTenantInvoices());
  }

  @PostMapping("/{invoiceId}/payments")
  public ApiResponse<InvoiceResponse> register(@PathVariable String invoiceId, @Valid @RequestBody RegisterPaymentRequest request) {
    return ApiResponse.ok(paymentApplicationService.register(invoiceId, request));
  }
}
