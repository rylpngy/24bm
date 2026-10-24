package com.procurement.order.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.order.application.ReceiptDispositionReviewApplicationService;
import com.procurement.order.domain.ReceiptDispositionReview;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/buyer/receipts/{receiptId}/disposition-review")
public class BuyerReceiptDispositionReviewController {
  private final ReceiptDispositionReviewApplicationService service;
  public BuyerReceiptDispositionReviewController(ReceiptDispositionReviewApplicationService service) { this.service = service; }

  @GetMapping
  public ApiResponse<ReceiptDispositionReview> get(@PathVariable String receiptId) {
    return ApiResponse.ok(service.get(receiptId));
  }

  @PostMapping
  public ApiResponse<ReceiptDispositionReview> create(@PathVariable String receiptId,
      @Valid @RequestBody CreateReceiptDispositionReviewRequest request) {
    return ApiResponse.ok(service.create(receiptId, request));
  }
}
