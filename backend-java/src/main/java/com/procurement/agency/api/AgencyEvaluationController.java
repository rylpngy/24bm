package com.procurement.agency.api;

import com.procurement.agency.application.AgencyEvaluationService;
import com.procurement.agency.application.AgencyExpertCheckIn;
import com.procurement.agency.domain.AgencyEvaluationRecords.*;
import com.procurement.common.api.ApiResponse;
import java.util.Map;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/buyer/agency/evaluation/packages/{pkg}/rounds")
public record AgencyEvaluationController(AgencyEvaluationService service, AgencyExpertCheckIn experts) {
  @GetMapping("/{id}/expert-check-in")
  public ApiResponse<AgencyExpertCheckIn.State> checkIn(@PathVariable String pkg, @PathVariable String id) {
    return ApiResponse.ok(experts.get(pkg, id));
  }

  @PutMapping("/{id}/expert-draw")
  public ApiResponse<AgencyExpertCheckIn.State> draw(@PathVariable String pkg, @PathVariable String id,
      @RequestBody AgencyExpertCheckIn.Draw request) {
    return ApiResponse.ok(experts.draw(pkg, id, request));
  }

  @PutMapping("/{id}/expert-attendance")
  public ApiResponse<AgencyExpertCheckIn.State> attendance(@PathVariable String pkg, @PathVariable String id,
      @RequestBody AgencyExpertCheckIn.Attendance request) {
    return ApiResponse.ok(experts.attendance(pkg, id, request));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyEvaluationWorkspace")
  @GetMapping
  public ApiResponse<Workspace> workspace(@PathVariable String pkg) {
    return ApiResponse.ok(service.workspace(pkg));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyEvaluationCreate")
  @PostMapping
  public ApiResponse<View> create(@PathVariable String pkg, @RequestBody Save r) {
    return ApiResponse.ok(service.save(pkg, null, r));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyEvaluationSave")
  @PutMapping("/{id}")
  public ApiResponse<View> save(
      @PathVariable String pkg, @PathVariable String id, @RequestBody Save r) {
    return ApiResponse.ok(service.save(pkg, id, r));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyEvaluationFreeze")
  @PostMapping("/{id}/freeze")
  public ApiResponse<View> freeze(
      @PathVariable String pkg, @PathVariable String id, @RequestBody Transition r) {
    return ApiResponse.ok(service.transition(pkg, id, r, true));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyEvaluationVoid")
  @PostMapping("/{id}/void")
  public ApiResponse<View> voidRound(
      @PathVariable String pkg, @PathVariable String id, @RequestBody Transition r) {
    return ApiResponse.ok(service.transition(pkg, id, r, false));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyEvaluationSnapshot")
  @GetMapping("/{id}/snapshot")
  public ApiResponse<Map<String, Object>> snapshot(
      @PathVariable String pkg, @PathVariable String id) {
    return ApiResponse.ok(service.snapshot(pkg, id));
  }
}
