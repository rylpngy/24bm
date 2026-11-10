package com.procurement.agency.api;

import com.procurement.agency.application.AgencyOfficeService;
import com.procurement.common.api.ApiResponse;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/buyer/agency")
public record AgencyOfficeController(AgencyOfficeService service) {
  @GetMapping("/packages/{pkg}/office")
  public ApiResponse<AgencyOfficeService.Office> one(@PathVariable String pkg) {
    return ApiResponse.ok(service.one(pkg));
  }

  @GetMapping("/groups/{group}/office")
  public ApiResponse<AgencyOfficeService.Office> group(@PathVariable String group) {
    return ApiResponse.ok(service.group(group));
  }

  @GetMapping("/groups/{group}/finance/export")
  public ResponseEntity<byte[]> export(@PathVariable String group) {
    return ResponseEntity.ok()
        .contentType(
            MediaType.parseMediaType(
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=agency-finance.xlsx")
        .header(HttpHeaders.CACHE_CONTROL, "no-store")
        .body(service.export(group));
  }
}
