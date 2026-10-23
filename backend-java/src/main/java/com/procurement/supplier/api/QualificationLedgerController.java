package com.procurement.supplier.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.supplier.application.QualificationLedgerService;
import org.springframework.web.bind.annotation.*;

@RestController
public record QualificationLedgerController(QualificationLedgerService service) {
  @GetMapping("/api/v1/buyer/suppliers/qualification-ledger")
  public ApiResponse<QualificationLedgerPage> list(
      @RequestParam(required = false) String keyword,
      @RequestParam(defaultValue = "all") String state,
      @RequestParam(defaultValue = "1") int page,
      @RequestParam(defaultValue = "8") int pageSize) {
    return ApiResponse.ok(service.list(keyword, state, page, pageSize));
  }
}
