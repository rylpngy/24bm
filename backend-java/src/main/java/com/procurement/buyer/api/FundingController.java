package com.procurement.buyer.api;

import com.procurement.buyer.api.FundingContracts.*;
import com.procurement.buyer.application.FundingService;
import com.procurement.common.api.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/buyer")
public record FundingController(FundingService service) {
  @Operation(operationId = "specialFundList")
  @GetMapping("/funding")
  public ApiResponse<FundPage> list(
      @RequestParam(defaultValue = "1") int page, @RequestParam(defaultValue = "20") int pageSize) {
    return ApiResponse.ok(service.funds(page, pageSize));
  }

  @Operation(operationId = "specialFundCreate")
  @PostMapping("/funding")
  public ApiResponse<Fund> create(@Valid @RequestBody Draft r) {
    return ApiResponse.ok(service.create(r));
  }

  @Operation(operationId = "specialFundHistory")
  @GetMapping("/funding/changes")
  public ApiResponse<ChangePage> history(
      @RequestParam(required = false) String fundId,
      @RequestParam(required = false) String projectId,
      @RequestParam(defaultValue = "1") int page,
      @RequestParam(defaultValue = "20") int pageSize) {
    return ApiResponse.ok(service.history(fundId, projectId, page, pageSize));
  }

  @Operation(operationId = "specialFundChangeSubmit")
  @PostMapping("/funding/changes")
  public ApiResponse<Change> submit(@Valid @RequestBody Request r) {
    return ApiResponse.ok(service.submit(r));
  }

  @Schema(name = "SpecialFundingWithdrawRequest")
  public record Withdraw(@NotBlank @Size(max = 1000) String reason) {}

  @Operation(operationId = "specialFundChangeWithdraw")
  @PostMapping("/funding/changes/{id}/withdraw")
  public ApiResponse<Change> withdraw(@PathVariable String id, @Valid @RequestBody Withdraw r) {
    return ApiResponse.ok(service.withdraw(id, r.reason()));
  }

  @Operation(operationId = "specialFundingProjectView")
  @GetMapping("/projects/{id}/funding")
  public ApiResponse<ProjectFunding> project(@PathVariable String id) {
    return ApiResponse.ok(service.project(id));
  }
}
