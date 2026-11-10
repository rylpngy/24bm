package com.procurement.agency.api;

import com.procurement.agency.application.AgencyPostService;
import com.procurement.agency.domain.AgencyPostRecords.*;
import com.procurement.common.api.ApiResponse;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/buyer/agency/packages/{pkg}/post")
public record AgencyPostController(AgencyPostService service) {
  @GetMapping
  public ApiResponse<Workspace> workspace(@PathVariable String pkg) {
    return ApiResponse.ok(service.workspace(pkg));
  }

  @PostMapping("/results")
  public ApiResponse<Result> decide(@PathVariable String pkg, @RequestBody Decision d) {
    return ApiResponse.ok(service.decide(pkg, d));
  }

  @PostMapping("/documents")
  public ApiResponse<Document> generate(@PathVariable String pkg, @RequestBody DocumentDraft d) {
    return ApiResponse.ok(service.generate(pkg, d));
  }

  @PostMapping("/documents/{id}/submit")
  public ApiResponse<Document> submit(
      @PathVariable String pkg, @PathVariable String id, @RequestBody Submit d) {
    return ApiResponse.ok(service.submit(pkg, id, d));
  }

  public record Withdrawal(String reason) {}

  @PostMapping("/documents/{id}/withdraw")
  public ApiResponse<Boolean> withdraw(
      @PathVariable String pkg, @PathVariable String id, @RequestBody Withdrawal d) {
    service.withdraw(pkg, id, d.reason());
    return ApiResponse.ok(true);
  }

  @PostMapping("/documents/{id}/actions")
  public ApiResponse<Document> act(
      @PathVariable String pkg, @PathVariable String id, @RequestBody Action d) {
    return ApiResponse.ok(service.act(pkg, id, d));
  }

  @PostMapping("/issues")
  public ApiResponse<Issue> issue(@PathVariable String pkg, @RequestBody IssueDraft d) {
    return ApiResponse.ok(service.issue(pkg, null, d));
  }

  @PutMapping("/issues/{id}")
  public ApiResponse<Issue> updateIssue(
      @PathVariable String pkg, @PathVariable String id, @RequestBody IssueDraft d) {
    return ApiResponse.ok(service.issue(pkg, id, d));
  }
}
