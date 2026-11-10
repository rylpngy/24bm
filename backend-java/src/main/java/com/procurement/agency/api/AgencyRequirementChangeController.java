package com.procurement.agency.api;

import com.procurement.agency.application.AgencyRequirementChangeService;
import com.procurement.agency.domain.AgencyRequirementChangeRecords.*;
import com.procurement.common.api.ApiResponse;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(
    "/api/v1/buyer/agency/evaluation/packages/{pkg}/sessions/{session}/requirement-changes")
public record AgencyRequirementChangeController(AgencyRequirementChangeService service) {
  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyRequirementChangesWorkspace")
  @GetMapping
  public ApiResponse<Workspace> workspace(@PathVariable String pkg, @PathVariable String session) {
    return ApiResponse.ok(service.workspace(pkg, session));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyRequirementChangeCreate")
  @PostMapping
  public ApiResponse<Change> create(
      @PathVariable String pkg, @PathVariable String session, @RequestBody Create d) {
    return ApiResponse.ok(service.create(pkg, session, d));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyRequirementNoticeRegister")
  @PostMapping("/{id}/receipts")
  public ApiResponse<Receipt> register(
      @PathVariable String pkg,
      @PathVariable String session,
      @PathVariable String id,
      @RequestBody Register d) {
    return ApiResponse.ok(service.register(pkg, session, id, d));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyRequirementNoticeComplete")
  @PostMapping("/{id}/complete")
  public ApiResponse<Change> complete(
      @PathVariable String pkg,
      @PathVariable String session,
      @PathVariable String id,
      @RequestBody Complete d) {
    return ApiResponse.ok(service.complete(pkg, session, id, d));
  }
}
