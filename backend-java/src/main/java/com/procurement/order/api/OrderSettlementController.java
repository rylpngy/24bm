package com.procurement.order.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.order.api.OrderSettlementContracts.*;
import com.procurement.order.application.OrderSettlementService;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/buyer/orders/{orderId}/settlements")
public record OrderSettlementController(OrderSettlementService service) {
  @GetMapping
  public ApiResponse<View> list(
      @PathVariable String orderId,
      @RequestParam(defaultValue = "1") int page,
      @RequestParam(defaultValue = "10") int size) {
    return ApiResponse.ok(service.view(orderId, false, page, size));
  }

  @PostMapping
  public ApiResponse<Entry> create(
      @PathVariable String orderId, @Valid @RequestBody Proposal request) {
    return ApiResponse.ok(service.propose(orderId, request));
  }

  @GetMapping("/{id}")
  public ApiResponse<Detail> detail(@PathVariable String orderId, @PathVariable String id) {
    return ApiResponse.ok(service.detail(orderId, id, false));
  }

  @PostMapping("/{id}/actions")
  public ApiResponse<Entry> action(
      @PathVariable String orderId, @PathVariable String id, @Valid @RequestBody Action request) {
    return ApiResponse.ok(service.act(orderId, id, request, false));
  }

  @PostMapping("/{id}/evidence")
  public ApiResponse<Evidence> evidence(
      @PathVariable String orderId,
      @PathVariable String id,
      @Valid @RequestBody EvidenceRequest request) {
    return ApiResponse.ok(service.evidence(orderId, id, request));
  }

  @GetMapping("/{id}/agreement")
  public ResponseEntity<byte[]> agreement(@PathVariable String orderId, @PathVariable String id) {
    return ResponseEntity.ok()
        .contentType(MediaType.APPLICATION_OCTET_STREAM)
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=settlement-agreement")
        .body(service.agreement(orderId, id, false));
  }
}
