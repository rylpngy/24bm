package com.procurement.supplier.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.supplier.application.SupplierDiscoveryApplicationService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

// 寻源发现:GET 平台可纳入的供应商企业(尚未在本租户私域库)。纳入复用 POST /api/v1/buyer/suppliers。
@RestController
@RequestMapping("/api/v1/buyer/suppliers/discover")
public class BuyerSupplierDiscoveryController {
  private final SupplierDiscoveryApplicationService supplierDiscoveryApplicationService;

  public BuyerSupplierDiscoveryController(
      SupplierDiscoveryApplicationService supplierDiscoveryApplicationService) {
    this.supplierDiscoveryApplicationService = supplierDiscoveryApplicationService;
  }

  @GetMapping
  public ApiResponse<List<DiscoverableSupplierResponse>> discover(
      @RequestParam(required = false) String keyword) {
    return ApiResponse.ok(supplierDiscoveryApplicationService.discover(keyword));
  }
}
