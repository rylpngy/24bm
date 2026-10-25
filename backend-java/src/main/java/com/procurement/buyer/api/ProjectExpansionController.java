package com.procurement.buyer.api;

import com.procurement.buyer.api.ProjectExpansionContracts.*;
import com.procurement.buyer.application.ProjectExpansionService;
import com.procurement.common.api.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/buyer/projects/{project}")
public record ProjectExpansionController(ProjectExpansionService service) {
  @Operation(operationId = "procurementProjectPackageBalances")
  @GetMapping("/package-balances")
  public ApiResponse<java.util.List<Balance>> balances(@PathVariable String project) {
    return ApiResponse.ok(service.balances(project));
  }

  @Operation(operationId = "procurementProjectPackages")
  @GetMapping("/packages")
  public ApiResponse<java.util.List<PackageDetail>> packages(@PathVariable String project) {
    return ApiResponse.ok(service.packages(project));
  }

  @Operation(operationId = "procurementProjectPackageCreate")
  @PostMapping("/packages")
  public ApiResponse<PackageDetail> create(
      @PathVariable String project, @RequestBody @Valid PackageDraft d) {
    return ApiResponse.ok(service.savePackage(project, null, d));
  }

  @Operation(operationId = "procurementProjectPackageEdit")
  @PutMapping("/packages/{id}")
  public ApiResponse<PackageDetail> edit(
      @PathVariable String project, @PathVariable String id, @RequestBody @Valid PackageDraft d) {
    return ApiResponse.ok(service.savePackage(project, id, d));
  }

  @Operation(operationId = "procurementProjectPackageCancel")
  @PostMapping("/packages/{id}/cancel")
  public ApiResponse<PackageDetail> cancel(
      @PathVariable String project, @PathVariable String id, @RequestBody @Valid PackageAction a) {
    return ApiResponse.ok(service.cancel(project, id, a));
  }

  @Operation(operationId = "procurementProjectPackageCreateDemand")
  @PostMapping("/packages/{id}/create-demand")
  public ApiResponse<PackageDetail> demand(
      @PathVariable String project, @PathVariable String id, @RequestBody @Valid PackageAction a) {
    return ApiResponse.ok(service.createDemand(project, id, a));
  }

  @Operation(operationId = "procurementProjectPackageLinkDemand")
  @PostMapping("/packages/{id}/demands")
  public ApiResponse<PackageDetail> link(
      @PathVariable String project,
      @PathVariable String id,
      @RequestBody @Valid PackageDemandLink a) {
    return ApiResponse.ok(service.link(project, id, a));
  }

  @Operation(operationId = "procurementProjectPackageExecute")
  @PostMapping("/packages/{id}/execution")
  public ApiResponse<PackageDetail> execute(
      @PathVariable String project,
      @PathVariable String id,
      @RequestBody @Valid PackageExecution a) {
    return ApiResponse.ok(service.execute(project, id, a, false));
  }

  @Operation(operationId = "procurementProjectPackageRetry")
  @PostMapping("/packages/{id}/retry")
  public ApiResponse<PackageDetail> retry(
      @PathVariable String project,
      @PathVariable String id,
      @RequestBody @Valid PackageExecution a) {
    return ApiResponse.ok(service.execute(project, id, a, true));
  }

  @Operation(operationId = "procurementProjectPackageExecutionDetail")
  @GetMapping("/packages/{id}/execution")
  public ApiResponse<ProjectContracts.Execution> execution(
      @PathVariable String project, @PathVariable String id) {
    return ApiResponse.ok(service.packageExecution(project, id));
  }

  @Operation(operationId = "procurementProjectPackageClose")
  @PostMapping("/packages/{id}/close")
  public ApiResponse<PackageDetail> close(
      @PathVariable String project, @PathVariable String id, @RequestBody @Valid PackageAction a) {
    return ApiResponse.ok(service.closePackage(project, id, a));
  }

  @Operation(operationId = "procurementProjectChanges")
  @GetMapping("/changes")
  public ApiResponse<ChangePage> changes(
      @PathVariable String project,
      @RequestParam(defaultValue = "1") int page,
      @RequestParam(defaultValue = "10") int pageSize) {
    return ApiResponse.ok(service.changes(project, page, pageSize));
  }

  @Operation(operationId = "procurementProjectChangeCreate")
  @PostMapping("/changes")
  public ApiResponse<Change> change(
      @PathVariable String project, @RequestBody @Valid ChangeDraft d) {
    return ApiResponse.ok(service.saveChange(project, null, d));
  }

  @Operation(operationId = "procurementProjectChangeDetail")
  @GetMapping("/changes/{id}")
  public ApiResponse<Change> detail(@PathVariable String project, @PathVariable String id) {
    return ApiResponse.ok(service.change(project, id, false));
  }

  @Operation(operationId = "procurementProjectChangeEdit")
  @PutMapping("/changes/{id}")
  public ApiResponse<Change> edit(
      @PathVariable String project, @PathVariable String id, @RequestBody @Valid ChangeDraft d) {
    return ApiResponse.ok(service.saveChange(project, id, d));
  }

  @Operation(operationId = "procurementProjectChangeSubmit")
  @PostMapping("/changes/{id}/submit")
  public ApiResponse<Change> submit(
      @PathVariable String project,
      @PathVariable String id,
      @RequestBody @Valid ProjectContracts.Action a) {
    return ApiResponse.ok(service.submitChange(project, id, a));
  }

  @Operation(operationId = "procurementProjectChangeWithdraw")
  @PostMapping("/changes/{id}/withdraw")
  public ApiResponse<Change> withdraw(
      @PathVariable String project,
      @PathVariable String id,
      @RequestBody @Valid ProjectContracts.Action a) {
    return ApiResponse.ok(service.withdrawChange(project, id, a));
  }
}
