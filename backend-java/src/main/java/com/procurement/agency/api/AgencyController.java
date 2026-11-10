package com.procurement.agency.api;

import com.procurement.agency.application.*;
import com.procurement.agency.domain.AgencyRecords.*;
import com.procurement.common.api.ApiResponse;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/buyer/agency")
public record AgencyController(AgencyService service, AgencyFiles files) {
  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyRequestGroupRequest")
  public record GroupRequest(String name, String tags) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyRequestSubmit")
  public record Submit(Long expectedVersion, String idempotencyKey, Map<String, Object> formData) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyRequestWithdraw")
  public record Withdraw(Long expectedVersion, String reason) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyRequestChange")
  public record Change(
      Draft proposed, String idempotencyKey, String reason, Map<String, Object> formData) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyRequestNumberingRequest")
  public record NumberingRequest(
      long expectedVersion,
      String pattern,
      String timeZone,
      Map<String, String> categories,
      Map<String, String> objects) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyRequestFileRequest")
  public record FileRequest(String name, String category, String visibility) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyRequestVersionRequest")
  public record VersionRequest(int expectedOrdinal, String reason) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyRequestSeal")
  public record Seal(String attachmentId) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyRequestReason")
  public record Reason(String reason) {}

  @io.swagger.v3.oas.annotations.media.Schema(name = "AgencyRequestBatch")
  public record Batch(List<Draft> packages, String idempotencyKey) {}

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyBatch")
  @PostMapping("/packages/batch")
  public ApiResponse<List<Detail>> batch(@RequestBody Batch r) {
    return ApiResponse.ok(service.batch(r.packages(), r.idempotencyKey()));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyOptions")
  @GetMapping("/options")
  public ApiResponse<Options> options() {
    return ApiResponse.ok(service.options());
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyNumbering")
  @PutMapping("/numbering")
  public ApiResponse<Numbering> numbering(@RequestBody NumberingRequest r) {
    return ApiResponse.ok(
        service.configure(
            r.expectedVersion(), r.pattern(), r.timeZone(), r.categories(), r.objects()));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyGroups")
  @GetMapping("/groups")
  public ApiResponse<List<Group>> groups(@RequestParam(defaultValue = "") String keyword) {
    return ApiResponse.ok(service.groups(keyword));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyGroup")
  @PostMapping("/groups")
  public ApiResponse<Group> group(@RequestBody GroupRequest r) {
    return ApiResponse.ok(service.createGroup(r.name(), r.tags()));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencySummary")
  @GetMapping("/groups/{id}/summary")
  public ApiResponse<Map<String, Object>> summary(@PathVariable String id) {
    return ApiResponse.ok(service.groupSummary(id));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyList")
  @GetMapping("/packages")
  public ApiResponse<Page> list(
      @RequestParam(defaultValue = "1") int page,
      @RequestParam(defaultValue = "10") int pageSize,
      @RequestParam(defaultValue = "") String status,
      @RequestParam(defaultValue = "") String groupId,
      @RequestParam(defaultValue = "") String procurementMethod,
      @RequestParam(defaultValue = "") String ownerId,
      @RequestParam(defaultValue = "") String keyword) {
    return ApiResponse.ok(
        service.list(page, pageSize, status, groupId, procurementMethod, ownerId, keyword));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyCreate")
  @PostMapping("/packages")
  public ApiResponse<Detail> create(@RequestBody Draft d) {
    return ApiResponse.ok(service.create(d));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyDetail")
  @GetMapping("/packages/{id}")
  public ApiResponse<Detail> detail(@PathVariable String id) {
    return ApiResponse.ok(service.detail(id));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyEdit")
  @PutMapping("/packages/{id}")
  public ApiResponse<Detail> edit(@PathVariable String id, @RequestBody Draft d) {
    return ApiResponse.ok(service.edit(id, d));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencySubmit")
  @PostMapping("/packages/{id}/submit")
  public ApiResponse<Detail> submit(@PathVariable String id, @RequestBody Submit r) {
    return ApiResponse.ok(
        service.submit(id, r.expectedVersion(), r.idempotencyKey(), r.formData()));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyWithdraw")
  @PostMapping("/packages/{id}/withdraw")
  public ApiResponse<Detail> withdraw(@PathVariable String id, @RequestBody Withdraw r) {
    return ApiResponse.ok(service.withdraw(id, r.expectedVersion(), r.reason()));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyChange")
  @PostMapping("/packages/{id}/changes")
  public ApiResponse<Detail> change(@PathVariable String id, @RequestBody Change r) {
    return ApiResponse.ok(
        service.change(id, r.proposed(), r.idempotencyKey(), r.reason(), r.formData()));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyReadiness")
  @GetMapping("/packages/{id}/execution-readiness")
  public ApiResponse<Map<String, Object>> readiness(@PathVariable String id) {
    return ApiResponse.ok(service.readiness(id));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyListFiles")
  @GetMapping("/packages/{id}/files")
  public ApiResponse<List<FileView>> listFiles(@PathVariable String id) {
    return ApiResponse.ok(files.list(id));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyCreateFile")
  @PostMapping("/packages/{id}/files")
  public ApiResponse<FileView> createFile(@PathVariable String id, @RequestBody FileRequest r) {
    return ApiResponse.ok(files.create(id, r.name(), r.category(), r.visibility()));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyVersion")
  @PostMapping("/files/{id}/versions")
  public ApiResponse<FileVersion> version(@PathVariable String id, @RequestBody VersionRequest r) {
    return ApiResponse.ok(files.next(id, r.expectedOrdinal(), r.reason()));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencySeal")
  @PostMapping("/file-versions/{id}/seal")
  public ApiResponse<FileVersion> seal(@PathVariable String id, @RequestBody Seal r) {
    return ApiResponse.ok(files.seal(id, r.attachmentId()));
  }

  @io.swagger.v3.oas.annotations.Operation(operationId = "agencyCancel")
  @PostMapping("/file-versions/{id}/cancel")
  public ApiResponse<Void> cancel(@PathVariable String id, @RequestBody Reason r) {
    files.cancel(id, r.reason());
    return ApiResponse.ok(null);
  }
}
