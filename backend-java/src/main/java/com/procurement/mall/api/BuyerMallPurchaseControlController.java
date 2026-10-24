package com.procurement.mall.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.mall.application.MallPurchaseControlApplicationService;
import com.procurement.mall.domain.MallPurchaseControl;
import jakarta.validation.Valid;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/buyer/mall")
public class BuyerMallPurchaseControlController {
  private final MallPurchaseControlApplicationService service;
  public BuyerMallPurchaseControlController(MallPurchaseControlApplicationService service) {this.service=service;}
  @GetMapping("/purchase-controls") public ApiResponse<MallPurchaseControl> get(){return ApiResponse.ok(service.get());}
  @PutMapping("/purchase-controls") public ApiResponse<MallPurchaseControl> save(@Valid @RequestBody SaveMallPurchaseControlRequest request){return ApiResponse.ok(service.save(request));}
  @GetMapping("/comparison") public ApiResponse<List<MallComparisonRow>> compare(@RequestParam String skuId,@RequestParam BigDecimal quantity){return ApiResponse.ok(service.compare(skuId,quantity));}
}
