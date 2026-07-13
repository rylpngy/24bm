package com.procurement.esign.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.esign.application.EsignApplicationService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/buyer/esign-records")
public class BuyerEsignController {
  private final EsignApplicationService esignApplicationService;

  public BuyerEsignController(EsignApplicationService esignApplicationService) {
    this.esignApplicationService = esignApplicationService;
  }

  @PostMapping
  public ApiResponse<EsignRecordResponse> sign(@Valid @RequestBody CreateEsignRequest request) {
    return ApiResponse.ok(esignApplicationService.buyerSign(request));
  }

  @GetMapping
  public ApiResponse<List<EsignRecordResponse>> list(
      @RequestParam String targetType, @RequestParam String targetId) {
    return ApiResponse.ok(esignApplicationService.listForBuyer(targetType, targetId));
  }
}
