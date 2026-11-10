package com.procurement.agency.api;

import com.procurement.agency.application.AgencyDocumentPreviewService;
import com.procurement.agency.domain.AgencyExecutionRecords.Job;
import com.procurement.common.api.ApiResponse;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/buyer/agency/execution/revisions/{id}/previews")
public record AgencyDocumentPreviewController(AgencyDocumentPreviewService service) {
  public record Request(String idempotencyKey) {}

  @GetMapping
  public ApiResponse<List<AgencyDocumentPreviewService.View>> list(@PathVariable String id) {
    return ApiResponse.ok(service.list(id));
  }

  @PostMapping
  public ApiResponse<Job> create(@PathVariable String id, @RequestBody Request d) {
    if (d == null) throw new IllegalArgumentException("缺少预览参数");
    return ApiResponse.ok(service.create(id, d.idempotencyKey()));
  }
}
