package com.procurement.platform.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.platform.application.PlatformTenantApplicationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
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

  public PlatformSupplierController(PlatformTenantApplicationService platformTenantApplicationService) {
    this.platformTenantApplicationService = platformTenantApplicationService;
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<SupplierEnterpriseResponse> create(
      @Valid @RequestBody CreateSupplierEnterpriseRequest request) {
    return ApiResponse.ok(platformTenantApplicationService.createSupplierEnterprise(request));
  }
}
