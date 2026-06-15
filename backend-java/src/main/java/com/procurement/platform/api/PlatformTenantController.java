package com.procurement.platform.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.platform.application.PlatformTenantApplicationService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/platform/tenants")
public class PlatformTenantController {
  private final PlatformTenantApplicationService platformTenantApplicationService;

  public PlatformTenantController(PlatformTenantApplicationService platformTenantApplicationService) {
    this.platformTenantApplicationService = platformTenantApplicationService;
  }

  @GetMapping
  public ApiResponse<List<TenantResponse>> list() {
    return ApiResponse.ok(platformTenantApplicationService.listTenants());
  }

  @PostMapping("/{tenantId}/features")
  public ApiResponse<TenantResponse> updateFeatures(
      @PathVariable String tenantId,
      @Valid @RequestBody FeatureToggleRequest request) {
    return ApiResponse.ok(platformTenantApplicationService.updateFeatureToggles(tenantId, request));
  }
}
