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

  @GetMapping("/{tenantId}")
  public ApiResponse<TenantResponse> get(@PathVariable String tenantId) {
    return ApiResponse.ok(platformTenantApplicationService.getTenant(tenantId));
  }

  @PostMapping
  public ApiResponse<TenantResponse> create(@Valid @RequestBody CreateTenantRequest request) {
    return ApiResponse.ok(platformTenantApplicationService.createBuyerTenant(request));
  }

  @PostMapping("/{tenantId}/features")
  public ApiResponse<TenantResponse> updateFeatures(
      @PathVariable String tenantId,
      @Valid @RequestBody FeatureToggleRequest request) {
    return ApiResponse.ok(platformTenantApplicationService.updateFeatureToggles(tenantId, request));
  }

  @PostMapping("/{tenantId}/plan")
  public ApiResponse<TenantResponse> updatePlan(
      @PathVariable String tenantId,
      @Valid @RequestBody UpdateTenantPlanRequest request) {
    return ApiResponse.ok(platformTenantApplicationService.updateTenantPlan(tenantId, request));
  }

  @GetMapping("/{tenantId}/plan-changes")
  public ApiResponse<List<TenantPlanChangeResponse>> planChanges(@PathVariable String tenantId) {
    return ApiResponse.ok(platformTenantApplicationService.listPlanChanges(tenantId));
  }

  @PostMapping("/{tenantId}/enable")
  public ApiResponse<TenantResponse> enable(@PathVariable String tenantId) {
    return ApiResponse.ok(platformTenantApplicationService.enableTenant(tenantId));
  }

  @PostMapping("/{tenantId}/disable")
  public ApiResponse<TenantResponse> disable(@PathVariable String tenantId) {
    return ApiResponse.ok(platformTenantApplicationService.disableTenant(tenantId));
  }
}
