package com.procurement.order.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.order.application.DeliveryApplicationService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// 采购方查看本租户物流发货（承运商/运单号/发货数量/发货日期/预计到货/物流备注）。
@RestController
@RequestMapping("/api/v1/buyer/deliveries")
public class BuyerDeliveryController {
  private final DeliveryApplicationService deliveryApplicationService;

  public BuyerDeliveryController(DeliveryApplicationService deliveryApplicationService) {
    this.deliveryApplicationService = deliveryApplicationService;
  }

  @GetMapping
  public ApiResponse<List<DeliveryResponse>> list() {
    return ApiResponse.ok(deliveryApplicationService.listCurrentTenantDeliveries());
  }
}
