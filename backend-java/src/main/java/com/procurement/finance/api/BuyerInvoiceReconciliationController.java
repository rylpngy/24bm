package com.procurement.finance.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.finance.application.PaymentApplicationService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/buyer/invoice-reconciliations")
public class BuyerInvoiceReconciliationController {
  private final PaymentApplicationService paymentApplicationService;

  public BuyerInvoiceReconciliationController(PaymentApplicationService paymentApplicationService) {
    this.paymentApplicationService = paymentApplicationService;
  }

  @GetMapping
  public ApiResponse<List<InvoiceReconciliationResponse>> list(
      @RequestParam(required = false) String stage,
      @RequestParam(required = false) String supplierId,
      @RequestParam(required = false) String orderId) {
    return ApiResponse.ok(paymentApplicationService.listCurrentTenantReconciliations(stage, supplierId, orderId));
  }
}
