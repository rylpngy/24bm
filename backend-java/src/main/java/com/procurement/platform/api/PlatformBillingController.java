package com.procurement.platform.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.platform.application.BillingApplicationService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/platform/tenants")
public class PlatformBillingController {
  private final BillingApplicationService billingApplicationService;

  public PlatformBillingController(BillingApplicationService billingApplicationService) {
    this.billingApplicationService = billingApplicationService;
  }

  @GetMapping("/{tenantId}/usage")
  public ApiResponse<TenantUsageResponse> usage(@PathVariable String tenantId) {
    return ApiResponse.ok(billingApplicationService.usageForTenant(tenantId));
  }
}
