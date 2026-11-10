package com.procurement.agency.api;

import com.procurement.agency.application.*;
import com.procurement.agency.domain.AgencyRecommendationRecords.*;
import com.procurement.common.api.ApiResponse;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/buyer/agency/evaluation/packages/{pkg}/sessions/{session}/recommendation")
public record AgencyRecommendationController(
    AgencyRecommendationService service, AgencyReportService reports) {
  @GetMapping
  public ApiResponse<Workspace> workspace(@PathVariable String pkg, @PathVariable String session) {
    return ApiResponse.ok(service.workspace(pkg, session));
  }

  @PostMapping("/preview")
  public ApiResponse<Preview> preview(
      @PathVariable String pkg, @PathVariable String session, @RequestBody Inputs d) {
    return ApiResponse.ok(service.preview(pkg, session, d));
  }

  @PostMapping
  public ApiResponse<Recommendation> confirm(
      @PathVariable String pkg, @PathVariable String session, @RequestBody Confirm d) {
    return ApiResponse.ok(service.confirm(pkg, session, d));
  }

  @PostMapping("/reports")
  public ApiResponse<Report> create(
      @PathVariable String pkg, @PathVariable String session, @RequestBody Draft d) {
    return ApiResponse.ok(reports.create(pkg, session, d));
  }

  @PutMapping("/reports/{id}")
  public ApiResponse<Report> save(
      @PathVariable String pkg,
      @PathVariable String session,
      @PathVariable String id,
      @RequestBody Draft d) {
    return ApiResponse.ok(reports.save(pkg, session, id, d));
  }

  @PostMapping("/reports/{id}/generate")
  public ApiResponse<Artifact> generate(
      @PathVariable String pkg,
      @PathVariable String session,
      @PathVariable String id,
      @RequestBody Command d) {
    return ApiResponse.ok(reports.generate(pkg, session, id, d));
  }

  @PostMapping("/reports/{id}/submit")
  public ApiResponse<Submission> submit(
      @PathVariable String pkg,
      @PathVariable String session,
      @PathVariable String id,
      @RequestBody Command d) {
    return ApiResponse.ok(reports.submit(pkg, session, id, d));
  }

  public record Withdrawal(String reason) {}

  @PostMapping("/submissions/{id}/withdraw")
  public ApiResponse<Boolean> withdraw(
      @PathVariable String pkg,
      @PathVariable String session,
      @PathVariable String id,
      @RequestBody Withdrawal d) {
    reports.withdraw(pkg, session, id, d.reason());
    return ApiResponse.ok(true);
  }
}
