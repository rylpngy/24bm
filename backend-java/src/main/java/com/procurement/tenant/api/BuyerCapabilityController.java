package com.procurement.tenant.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.tenant.application.TenantCapabilityApplicationService;
import com.procurement.tenant.domain.ProcurementMethodCatalog;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 采购方工作台能力查询(M-0):导航与创建向导按此渲染。 */
@RestController
@RequestMapping("/api/v1/buyer/capabilities")
public class BuyerCapabilityController {

  private final TenantCapabilityApplicationService tenantCapabilityApplicationService;

  public BuyerCapabilityController(
      TenantCapabilityApplicationService tenantCapabilityApplicationService) {
    this.tenantCapabilityApplicationService = tenantCapabilityApplicationService;
  }

  @GetMapping
  public ApiResponse<TenantCapabilityResponse> capabilities() {
    String tenantId = TenantAccessGuard.requireTenantId("buyer capability APIs");
    var features = tenantCapabilityApplicationService.enabledFeatures(tenantId);
    var methods = TenantCapabilityApplicationService.effectiveMethods(features);
    return ApiResponse.ok(new TenantCapabilityResponse(
        methods.stream()
            .map(m -> new TenantCapabilityResponse.MethodCapability(
                m.code(), m.label(), m.inCreateWizard()))
            .toList(),
        methods.stream().flatMap(m -> m.moduleIds().stream()).distinct().toList(),
        ProcurementMethodCatalog.allMethodModuleIds(), features,
        TenantCapabilityApplicationService.newBusinessModuleIds(features),
        TenantCapabilityApplicationService.historicalModuleIds()));
  }
}
