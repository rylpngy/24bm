package com.procurement.tender.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.tender.application.TenderApplicationService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/supplier/tenders")
public class SupplierTenderController {
  private final TenderApplicationService tenderApplicationService;

  public SupplierTenderController(TenderApplicationService tenderApplicationService) {
    this.tenderApplicationService = tenderApplicationService;
  }

  @GetMapping
  public ApiResponse<List<TenderResponse>> list() {
    return ApiResponse.ok(tenderApplicationService.listSupplierTenders());
  }

  @PostMapping("/{tenderId}/acquire")
  public ApiResponse<TenderResponse> acquire(@PathVariable String tenderId) {
    return ApiResponse.ok(tenderApplicationService.acquire(tenderId));
  }
}
