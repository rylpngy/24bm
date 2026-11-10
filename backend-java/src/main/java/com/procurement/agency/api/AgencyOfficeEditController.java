package com.procurement.agency.api;

import com.procurement.agency.application.AgencyOfficeEditService;
import com.procurement.agency.domain.AgencyExecutionRecords.Revision;
import com.procurement.agency.domain.AgencyOfficeEditRecords.*;
import com.procurement.common.api.ApiResponse;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/buyer/agency/execution/documents/{doc}/office")
public record AgencyOfficeEditController(AgencyOfficeEditService service) {
  @GetMapping
  public ApiResponse<Workspace> workspace(@PathVariable String doc) {
    return ApiResponse.ok(service.workspace(doc));
  }

  @PostMapping
  public ApiResponse<Open> start(@PathVariable String doc, @RequestBody Start d) {
    return ApiResponse.ok(service.start(doc, d));
  }

  @GetMapping("/{id}/config")
  public ApiResponse<Open> resume(@PathVariable String doc, @PathVariable String id) {
    return ApiResponse.ok(service.resume(doc, id));
  }

  @PostMapping("/{id}/save")
  public ApiResponse<java.util.Map<String, Object>> force(
      @PathVariable String doc, @PathVariable String id) {
    return ApiResponse.ok(service.force(doc, id));
  }

  @PostMapping("/{id}/adopt")
  public ApiResponse<Revision> adopt(
      @PathVariable String doc, @PathVariable String id, @RequestBody Command d) {
    return ApiResponse.ok(service.adopt(doc, id, d));
  }

  @PostMapping("/{id}/cancel")
  public ApiResponse<SessionView> cancel(
      @PathVariable String doc, @PathVariable String id, @RequestBody Command d) {
    return ApiResponse.ok(service.cancel(doc, id, d));
  }
}
