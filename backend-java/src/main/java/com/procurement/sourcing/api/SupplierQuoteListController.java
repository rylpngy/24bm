package com.procurement.sourcing.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.sourcing.application.QuoteApplicationService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/supplier/quotes")
public class SupplierQuoteListController {
  private final QuoteApplicationService quoteApplicationService;

  public SupplierQuoteListController(QuoteApplicationService quoteApplicationService) {
    this.quoteApplicationService = quoteApplicationService;
  }

  @GetMapping
  public ApiResponse<List<QuoteResponse>> list(
      @RequestParam(required = false) String rfqId,
      @RequestParam(required = false) String status) {
    return ApiResponse.ok(quoteApplicationService.listSupplierQuotes(rfqId, status));
  }

  @PutMapping("/{quoteId}")
  public ApiResponse<QuoteResponse> update(
      @PathVariable String quoteId,
      @Valid @RequestBody UpdateQuoteRequest request) {
    return ApiResponse.ok(quoteApplicationService.update(quoteId, request));
  }
}
