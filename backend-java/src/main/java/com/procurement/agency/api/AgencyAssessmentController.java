package com.procurement.agency.api;

import com.procurement.agency.application.AgencyAssessmentService;
import com.procurement.agency.domain.AgencyAssessmentRecords.*;
import com.procurement.common.api.ApiResponse;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/buyer/agency/evaluation/packages/{pkg}")
public record AgencyAssessmentController(AgencyAssessmentService service) {
  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyAssessmentOverview")
  @GetMapping("/rounds/{round}/assessment")
  public ApiResponse<Overview> overview(@PathVariable String pkg, @PathVariable String round) {
    return ApiResponse.ok(service.overview(pkg, round));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyAssessmentStart")
  @PostMapping("/rounds/{round}/assessment")
  public ApiResponse<Session> start(
      @PathVariable String pkg, @PathVariable String round, @RequestBody Start r) {
    return ApiResponse.ok(service.start(pkg, round, r));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyAssessmentMine")
  @GetMapping("/sessions/{session}/mine")
  public ApiResponse<Mine> mine(
      @PathVariable String pkg,
      @PathVariable String session,
      @RequestParam(required = false) String stage) {
    return ApiResponse.ok(service.mine(pkg, session, stage));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyAssessmentSave")
  @PutMapping("/sessions/{session}/mine")
  public ApiResponse<Sheet> save(
      @PathVariable String pkg,
      @PathVariable String session,
      @RequestParam(required = false) String stage,
      @RequestBody SheetSave r) {
    return ApiResponse.ok(service.save(pkg, session, stage, r));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyAssessmentSubmit")
  @PostMapping("/sessions/{session}/mine/submit")
  public ApiResponse<Sheet> submit(
      @PathVariable String pkg,
      @PathVariable String session,
      @RequestParam(required = false) String stage,
      @RequestBody Submit r) {
    return ApiResponse.ok(service.submit(pkg, session, stage, r));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyAssessmentProgress")
  @GetMapping("/sessions/{session}/progress")
  public ApiResponse<List<Progress>> progress(
      @PathVariable String pkg, @PathVariable String session) {
    return ApiResponse.ok(service.progress(pkg, session));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyAssessmentCorrection")
  @PostMapping("/sessions/{session}/corrections")
  public ApiResponse<Correction> correction(
      @PathVariable String pkg,
      @PathVariable String session,
      @RequestParam(required = false) String stage,
      @RequestBody CorrectionDraft r) {
    return ApiResponse.ok(service.correction(pkg, session, stage, r));
  }

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyAssessmentWithdraw")
  public record Withdraw(String reason) {}

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyAssessmentWithdrawCorrection")
  @PostMapping("/sessions/{session}/corrections/{id}/withdraw")
  public ApiResponse<Void> withdraw(
      @PathVariable String pkg,
      @PathVariable String session,
      @PathVariable String id,
      @RequestBody Withdraw r) {
    service.withdraw(pkg, session, id, r.reason());
    return ApiResponse.ok(null);
  }
}
