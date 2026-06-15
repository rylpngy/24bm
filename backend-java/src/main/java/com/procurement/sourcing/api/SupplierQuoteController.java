package com.procurement.sourcing.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.sourcing.application.QuoteApplicationService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/supplier/rfqs")
public class SupplierQuoteController {
  private final QuoteApplicationService quoteApplicationService;

  public SupplierQuoteController(QuoteApplicationService quoteApplicationService) {
    this.quoteApplicationService = quoteApplicationService;
  }

  @GetMapping
  public ApiResponse<List<RfqResponse>> listRfqs() {
    return ApiResponse.ok(quoteApplicationService.listSupplierRfqs());
  }

  @PostMapping("/{rfqId}/quotes")
  @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<QuoteResponse> submit(@PathVariable String rfqId, @Valid @RequestBody SubmitQuoteRequest request) {
    return ApiResponse.ok(quoteApplicationService.submit(rfqId, request));
  }
}
