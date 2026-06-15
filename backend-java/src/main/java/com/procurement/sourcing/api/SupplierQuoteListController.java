package com.procurement.sourcing.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.sourcing.application.QuoteApplicationService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/supplier/quotes")
public class SupplierQuoteListController {
  private final QuoteApplicationService quoteApplicationService;

  public SupplierQuoteListController(QuoteApplicationService quoteApplicationService) {
    this.quoteApplicationService = quoteApplicationService;
  }

  @GetMapping
  public ApiResponse<List<QuoteResponse>> list() {
    return ApiResponse.ok(quoteApplicationService.listSupplierQuotes());
  }
}
