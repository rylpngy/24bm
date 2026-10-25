package com.procurement.buyer.api;

import com.procurement.buyer.api.ProjectContracts.*;
import com.procurement.buyer.application.ProcurementProjectService;
import com.procurement.common.api.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/buyer/projects")
public record ProcurementProjectController(ProcurementProjectService service) {
  @Operation(operationId = "procurementProjectOptions")
  @GetMapping("/options")
  public ApiResponse<Options> options() {
    return ApiResponse.ok(service.options());
  }

  @Operation(operationId = "procurementProjectList")
  @GetMapping
  public ApiResponse<Page> list(
      @RequestParam(defaultValue = "1") int page,
      @RequestParam(defaultValue = "10") int pageSize,
      @RequestParam(defaultValue = "") String status,
      @RequestParam(defaultValue = "") String keyword) {
    return ApiResponse.ok(service.list(page, pageSize, status, keyword));
  }

  @Operation(operationId = "procurementProjectDetail")
  @GetMapping("/{id}")
  public ApiResponse<Detail> detail(@PathVariable String id) {
    return ApiResponse.ok(service.detail(id));
  }

  @Operation(operationId = "procurementProjectCreate")
  @PostMapping
  public ApiResponse<Detail> create(@Valid @RequestBody Draft d) {
    return ApiResponse.ok(service.create(d));
  }

  @Operation(operationId = "procurementProjectEdit")
  @PutMapping("/{id}")
  public ApiResponse<Detail> edit(@PathVariable String id, @Valid @RequestBody Draft d) {
    return ApiResponse.ok(service.edit(id, d));
  }

  @Operation(operationId = "procurementProjectSubmit")
  @PostMapping("/{id}/submit")
  public ApiResponse<Detail> submit(@PathVariable String id, @Valid @RequestBody Action a) {
    return ApiResponse.ok(service.submit(id, a));
  }

  @Operation(operationId = "procurementProjectWithdraw")
  @PostMapping("/{id}/withdraw")
  public ApiResponse<Detail> withdraw(@PathVariable String id, @Valid @RequestBody Action a) {
    return ApiResponse.ok(service.withdraw(id, a));
  }

  @Operation(operationId = "procurementProjectTerminate")
  @PostMapping("/{id}/terminate")
  public ApiResponse<Detail> terminate(@PathVariable String id, @Valid @RequestBody Action a) {
    return ApiResponse.ok(service.terminate(id, a));
  }

  @Operation(operationId = "procurementProjectClose")
  @PostMapping("/{id}/close")
  public ApiResponse<Detail> close(@PathVariable String id, @Valid @RequestBody Action a) {
    return ApiResponse.ok(service.close(id, a));
  }

  @Operation(operationId = "procurementProjectDemands")
  @GetMapping("/{id}/demands")
  public ApiResponse<java.util.List<Demand>> demands(@PathVariable String id) {
    return ApiResponse.ok(service.demands(id));
  }

  @Operation(operationId = "procurementProjectLinkDemand")
  @PostMapping("/{id}/demands")
  public ApiResponse<Detail> link(@PathVariable String id, @Valid @RequestBody LinkRequest r) {
    return ApiResponse.ok(service.link(id, r));
  }

  @Operation(operationId = "procurementProjectCreateDemand")
  @PostMapping("/{id}/create-demand")
  public ApiResponse<Detail> createDemand(@PathVariable String id, @Valid @RequestBody Action a) {
    return ApiResponse.ok(service.createDemand(id, a));
  }

  @Operation(operationId = "procurementProjectCreateExecution")
  @PostMapping("/{id}/execution")
  public ApiResponse<Detail> createExecution(
      @PathVariable String id, @Valid @RequestBody ExecutionRequest r) {
    return ApiResponse.ok(service.createExecution(id, r));
  }

  @Operation(operationId = "procurementProjectExecution")
  @GetMapping("/{id}/execution")
  public ApiResponse<Execution> execution(@PathVariable String id) {
    return ApiResponse.ok(service.execution(id));
  }

  @Operation(operationId = "procurementProjectBudget")
  @GetMapping("/{id}/budget")
  public ApiResponse<com.procurement.buyer.domain.BudgetPosition> budget(@PathVariable String id) {
    return ApiResponse.ok(service.budget(id));
  }
}
