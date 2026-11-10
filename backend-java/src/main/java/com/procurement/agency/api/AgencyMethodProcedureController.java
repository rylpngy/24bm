package com.procurement.agency.api;

import com.procurement.agency.application.AgencyMethodProcedureService;
import com.procurement.agency.domain.AgencyMethodRecords.*;
import com.procurement.common.api.ApiResponse;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/buyer/agency/evaluation/packages/{pkg}")
public record AgencyMethodProcedureController(AgencyMethodProcedureService service) {
  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyMethodProcedureWorkspace")
  @GetMapping("/rounds/{round}/procedures")
  public ApiResponse<Workspace> workspace(@PathVariable String pkg, @PathVariable String round) {
    return ApiResponse.ok(service.workspace(pkg, round));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyInvitationRecord")
  @PostMapping("/rounds/{round}/procedures/invitation")
  public ApiResponse<Row> invitation(
      @PathVariable String pkg, @PathVariable String round, @RequestBody Invitation d) {
    return ApiResponse.ok(service.invitation(pkg, round, d));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencySingleSourceBasis")
  @PostMapping("/rounds/{round}/procedures/single-basis")
  public ApiResponse<Row> singleBasis(
      @PathVariable String pkg, @PathVariable String round, @RequestBody SingleBasis d) {
    return ApiResponse.ok(service.singleBasis(pkg, round, d));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyInquiryValidity")
  @PostMapping("/sessions/{session}/procedures/inquiry")
  public ApiResponse<Row> inquiry(
      @PathVariable String pkg, @PathVariable String session, @RequestBody Inquiry d) {
    return ApiResponse.ok(service.inquiry(pkg, session, d));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencySingleSourceNegotiation")
  @PostMapping("/sessions/{session}/procedures/negotiation")
  public ApiResponse<Row> negotiation(
      @PathVariable String pkg, @PathVariable String session, @RequestBody Negotiation d) {
    return ApiResponse.ok(service.negotiation(pkg, session, d));
  }
}
