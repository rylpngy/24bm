package com.procurement.supplier.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.supplier.application.SupplierInvitationApplicationService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/supplier/cooperation-invitations")
public class SupplierCooperationInvitationController {
  private final SupplierInvitationApplicationService service;
  public SupplierCooperationInvitationController(SupplierInvitationApplicationService service) { this.service = service; }

  @GetMapping
  public ApiResponse<List<SupplierInvitationResponse>> list() {
    return ApiResponse.ok(service.listSupplierInvitations());
  }

  @PostMapping("/{id}/respond")
  public ApiResponse<SupplierInvitationResponse> respond(@PathVariable String id,
      @Valid @RequestBody RespondSupplierInvitationRequest request) {
    return ApiResponse.ok(service.respondSupplier(id,request));
  }
}
