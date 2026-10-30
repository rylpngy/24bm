package com.procurement.finance.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.finance.application.InvoiceApplicationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/supplier/orders")
public class SupplierInvoiceController {
  private final InvoiceApplicationService invoiceApplicationService;

  public SupplierInvoiceController(InvoiceApplicationService invoiceApplicationService) {
    this.invoiceApplicationService = invoiceApplicationService;
  }

  @org.springframework.web.bind.annotation.GetMapping("/{orderId}/invoices/preview")
  public ApiResponse<InvoiceIssuancePreview> preview(@PathVariable String orderId) {
    return ApiResponse.ok(invoiceApplicationService.issuancePreview(orderId));
  }

  @PostMapping("/{orderId}/invoices")
  @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<InvoiceResponse> create(@PathVariable String orderId, @Valid @RequestBody CreateInvoiceRequest request) {
    return ApiResponse.ok(invoiceApplicationService.create(orderId, request));
  }
}
