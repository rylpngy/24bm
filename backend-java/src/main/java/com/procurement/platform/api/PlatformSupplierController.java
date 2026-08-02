package com.procurement.platform.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.platform.application.PlatformTenantApplicationService;
import com.procurement.platform.application.SupplierCreditApplicationService;
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

// 平台侧供应商开通:干净环境引导链路(供应商无自助注册,由平台运营建档 + 初始管理员)。
@RestController
@RequestMapping("/api/v1/platform/suppliers")
public class PlatformSupplierController {
  private final PlatformTenantApplicationService platformTenantApplicationService;
  private final SupplierCreditApplicationService supplierCreditApplicationService;

  public PlatformSupplierController(
      PlatformTenantApplicationService platformTenantApplicationService,
      SupplierCreditApplicationService supplierCreditApplicationService) {
    this.platformTenantApplicationService = platformTenantApplicationService;
    this.supplierCreditApplicationService = supplierCreditApplicationService;
  }

  /** 供应商信用画像榜:跨租户履约聚合与加权信用分。 */
  @GetMapping("/credit-profiles")
  public ApiResponse<List<SupplierCreditProfileResponse>> creditProfiles() {
    return ApiResponse.ok(supplierCreditApplicationService.listProfiles());
  }

  @GetMapping("/{supplierId}/credit-profile")
  public ApiResponse<SupplierCreditProfileResponse> creditProfile(@PathVariable String supplierId) {
    return ApiResponse.ok(supplierCreditApplicationService.profile(supplierId));
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<SupplierEnterpriseResponse> create(
      @Valid @RequestBody CreateSupplierEnterpriseRequest request) {
    return ApiResponse.ok(platformTenantApplicationService.createSupplierEnterprise(request));
  }
}
