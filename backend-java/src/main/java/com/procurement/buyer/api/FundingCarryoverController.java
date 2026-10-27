package com.procurement.buyer.api;

import com.procurement.buyer.application.FundingCarryoverService;
import com.procurement.common.api.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/buyer/projects/{id}/funding/carryover")
public record FundingCarryoverController(FundingCarryoverService service) {
  @Operation(operationId = "specialFundingCarryoverOptions")
  @GetMapping
  public ApiResponse<FundingCarryoverContracts.Options> options(
      @PathVariable String id, @RequestParam String targetPeriod) {
    return ApiResponse.ok(service.options(id, targetPeriod));
  }
}
