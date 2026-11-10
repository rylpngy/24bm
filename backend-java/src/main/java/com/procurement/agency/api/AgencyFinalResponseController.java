package com.procurement.agency.api;

import com.procurement.agency.application.AgencyFinalResponseService;
import com.procurement.agency.domain.AgencyFinalResponseRecords.*;
import com.procurement.common.api.ApiResponse;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(
    "/api/v1/buyer/agency/evaluation/packages/{pkg}/sessions/{session}/final-response-review")
public record AgencyFinalResponseController(AgencyFinalResponseService service) {
  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyFinalResponseWorkspace")
  @GetMapping
  public ApiResponse<Workspace> workspace(@PathVariable String pkg, @PathVariable String session) {
    return ApiResponse.ok(service.workspace(pkg, session));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyFinalResponseActivate")
  @PostMapping("/activate")
  public ApiResponse<Plan> activate(
      @PathVariable String pkg, @PathVariable String session, @RequestBody Activate d) {
    return ApiResponse.ok(service.activate(pkg, session, d));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyFinalResponseMine")
  @GetMapping("/mine")
  public ApiResponse<Mine> mine(@PathVariable String pkg, @PathVariable String session) {
    return ApiResponse.ok(service.mine(pkg, session));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyFinalResponseSave")
  @PutMapping("/mine")
  public ApiResponse<Sheet> save(
      @PathVariable String pkg, @PathVariable String session, @RequestBody Save d) {
    return ApiResponse.ok(service.save(pkg, session, d));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyFinalResponseSubmit")
  @PostMapping("/mine/submit")
  public ApiResponse<Sheet> submit(
      @PathVariable String pkg, @PathVariable String session, @RequestBody Submit d) {
    return ApiResponse.ok(service.submit(pkg, session, d));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyFinalResponseCorrection")
  @PostMapping("/corrections")
  public ApiResponse<com.procurement.agency.domain.AgencyAssessmentRecords.Correction> correction(
      @PathVariable String pkg, @PathVariable String session, @RequestBody CorrectionDraft d) {
    return ApiResponse.ok(service.correction(pkg, session, d));
  }

  public record Withdraw(String reason) {}

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyFinalResponseCorrectionWithdraw")
  @PostMapping("/corrections/{id}/withdraw")
  public ApiResponse<Void> withdraw(
      @PathVariable String pkg,
      @PathVariable String session,
      @PathVariable String id,
      @RequestBody Withdraw d) {
    service.withdraw(pkg, session, id, d.reason());
    return ApiResponse.ok(null);
  }
}
