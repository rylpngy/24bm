package com.procurement.agency.api;

import com.procurement.agency.application.AgencyArchiveService;
import com.procurement.agency.domain.AgencyArchiveRecords.*;
import com.procurement.common.api.ApiResponse;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/buyer/agency")
public record AgencyArchiveController(AgencyArchiveService service) {
  @GetMapping("/packages/{pkg}/archive")
  public ApiResponse<Workspace> workspace(@PathVariable String pkg) {
    return ApiResponse.ok(service.workspace(pkg));
  }

  @PutMapping("/packages/{pkg}/archive/checklist/{key}")
  public ApiResponse<Checklist> save(
      @PathVariable String pkg, @PathVariable String key, @RequestBody ChecklistDraft d) {
    return ApiResponse.ok(service.save(pkg, key, d));
  }

  @PostMapping("/packages/{pkg}/archive/snapshots")
  public ApiResponse<SnapshotView> freeze(@PathVariable String pkg, @RequestBody Freeze d) {
    return ApiResponse.ok(service.freeze(pkg, d));
  }

  @PostMapping("/packages/{pkg}/archive/states")
  public ApiResponse<Workspace> change(@PathVariable String pkg, @RequestBody StateChange d) {
    return ApiResponse.ok(service.changeState(pkg, d));
  }

  @GetMapping("/packages/{pkg}/archive/snapshots/{id}/export")
  public ResponseEntity<byte[]> export(@PathVariable String pkg, @PathVariable String id) {
    return zip(service.export(pkg, id));
  }

  @GetMapping("/groups/{group}/archive/export")
  public ResponseEntity<byte[]> group(@PathVariable String group) {
    return zip(service.exportGroup(group));
  }

  private ResponseEntity<byte[]> zip(byte[] bytes) {
    return ResponseEntity.ok()
        .contentType(MediaType.parseMediaType("application/zip"))
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=agency-archive.zip")
        .header(HttpHeaders.CACHE_CONTROL, "no-store")
        .body(bytes);
  }
}
