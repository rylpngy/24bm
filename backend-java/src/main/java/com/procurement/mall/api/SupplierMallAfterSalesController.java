package com.procurement.mall.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.mall.application.MallServiceApplicationService;
import com.procurement.mall.domain.MallAfterSalesEvent;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/supplier/mall/after-sales")
public class SupplierMallAfterSalesController {
  private final MallServiceApplicationService service;

  public SupplierMallAfterSalesController(MallServiceApplicationService service) {
    this.service = service;
  }

  @GetMapping("/{id}/history")
  public ApiResponse<List<MallAfterSalesEvent>> history(@PathVariable String id) {
    return ApiResponse.ok(service.supplierHistory(id));
  }
}
