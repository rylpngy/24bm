package com.procurement.order.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.order.application.ReceiptApplicationService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/buyer")
public class BuyerReceiptController {
  private final ReceiptApplicationService receiptApplicationService;

  public BuyerReceiptController(ReceiptApplicationService receiptApplicationService) {
    this.receiptApplicationService = receiptApplicationService;
  }

  @GetMapping("/receipts")
  public ApiResponse<List<ReceiptResponse>> list(
      @RequestParam(required = false) String orderId,
      @RequestParam(required = false) String receiverId) {
    return ApiResponse.ok(receiptApplicationService.listCurrentTenantReceipts(orderId, receiverId));
  }

  @PostMapping("/orders/{orderId}/receipts")
  @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<ReceiptResponse> create(@PathVariable String orderId, @Valid @RequestBody CreateReceiptRequest request) {
    return ApiResponse.ok(receiptApplicationService.create(orderId, request));
  }
}
