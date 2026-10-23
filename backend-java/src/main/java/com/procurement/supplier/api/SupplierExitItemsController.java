package com.procurement.supplier.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.supplier.application.SupplierExitItemsService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/buyer/suppliers")
public class SupplierExitItemsController {
  private final SupplierExitItemsService service;
  public SupplierExitItemsController(SupplierExitItemsService service) { this.service = service; }

  @GetMapping("/{relationId}/exit-items")
  public ApiResponse<SupplierExitItemsPage> list(@PathVariable String relationId, @RequestParam String kind,
      @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "10") int pageSize) {
    return ApiResponse.ok(service.list(relationId, kind, page, pageSize));
  }
}
