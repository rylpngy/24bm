package com.procurement.mall.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.mall.application.MallServiceApplicationService;
import com.procurement.mall.domain.MallAfterSalesEvent;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/buyer/mall/after-sales")
public class BuyerMallAfterSalesController {
  private final MallServiceApplicationService service;
  @org.springframework.beans.factory.annotation.Autowired
  private com.procurement.mall.application.PhysicalAfterSalesService physical;

  @GetMapping("/{id}/physical")
  public ApiResponse<PhysicalAfterSalesContracts.View> physical(@PathVariable String id) {
    return ApiResponse.ok(physical.view(id,false));
  }
  @PostMapping("/{id}/physical")
  public ApiResponse<PhysicalAfterSalesContracts.View> physicalAction(@PathVariable String id,@Valid @RequestBody PhysicalAfterSalesContracts.Action request) {
    return ApiResponse.ok(physical.act(id,request,false));
  }
  @GetMapping("/{id}/physical/{event}/file")
  public org.springframework.http.ResponseEntity<byte[]> physicalFile(@PathVariable String id,@PathVariable String event) {
    var file=physical.file(id,event,false);
    return org.springframework.http.ResponseEntity.ok().contentType(org.springframework.http.MediaType.APPLICATION_OCTET_STREAM)
      .header("Content-Disposition",org.springframework.http.ContentDisposition.attachment().filename(file.fileName(),java.nio.charset.StandardCharsets.UTF_8).build().toString())
      .header("X-Content-SHA256",file.sha256()).body(file.bytes());
  }

  public BuyerMallAfterSalesController(MallServiceApplicationService service) {
    this.service = service;
  }

  @PostMapping("/{id}/confirm")
  public ApiResponse<List<MallAfterSalesResponse>> confirm(
      @PathVariable String id, @Valid @RequestBody BuyerAfterSalesActionRequest request) {
    return ApiResponse.ok(service.buyerAction(id, "confirm", request.note()).stream()
        .map(MallAfterSalesResponse::from).toList());
  }

  @PostMapping("/{id}/withdraw")
  public ApiResponse<List<MallAfterSalesResponse>> withdraw(
      @PathVariable String id, @Valid @RequestBody BuyerAfterSalesActionRequest request) {
    return ApiResponse.ok(service.buyerAction(id, "withdraw", request.note()).stream()
        .map(MallAfterSalesResponse::from).toList());
  }

  @GetMapping("/{id}/history")
  public ApiResponse<List<MallAfterSalesEvent>> history(@PathVariable String id) {
    return ApiResponse.ok(service.buyerHistory(id));
  }
}
