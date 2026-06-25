package com.procurement.supplier.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.supplier.application.SupplierFulfillmentMetricsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/buyer/suppliers")
public class SupplierFulfillmentController {
  private final SupplierFulfillmentMetricsService supplierFulfillmentMetricsService;

  public SupplierFulfillmentController(
      SupplierFulfillmentMetricsService supplierFulfillmentMetricsService) {
    this.supplierFulfillmentMetricsService = supplierFulfillmentMetricsService;
  }

  @GetMapping("/{supplierId}/fulfillment-metrics")
  public ApiResponse<SupplierFulfillmentMetricsResponse> fulfillmentMetrics(
      @PathVariable String supplierId) {
    return ApiResponse.ok(supplierFulfillmentMetricsService.metricsForSupplier(supplierId));
  }
}
