package com.procurement.finance.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.finance.application.PaymentReviewApplicationService;
import com.procurement.finance.domain.PaymentReviewNote;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/buyer/payment-reviews")
public class BuyerPaymentReviewController {
  private final PaymentReviewApplicationService service;
  public BuyerPaymentReviewController(PaymentReviewApplicationService service) { this.service = service; }

  @GetMapping
  public ApiResponse<PaymentReviewApplicationService.Page> list(@RequestParam(defaultValue = "1") int page,
      @RequestParam(defaultValue = "10") int pageSize, @RequestParam(defaultValue = "") String keyword,
      @RequestParam(defaultValue = "") String paymentStatus) {
    return ApiResponse.ok(service.list(page, pageSize, keyword, paymentStatus));
  }

  @GetMapping("/{invoiceId}")
  public ApiResponse<PaymentReviewApplicationService.Detail> detail(@PathVariable String invoiceId,
      @RequestParam(defaultValue = "1") int page) { return ApiResponse.ok(service.detail(invoiceId, page)); }

  @PostMapping("/{invoiceId}/notes")
  public ApiResponse<PaymentReviewNote> record(@PathVariable String invoiceId,
      @Valid @RequestBody PaymentReviewNoteRequest input) { return ApiResponse.ok(service.record(invoiceId, input)); }
}
