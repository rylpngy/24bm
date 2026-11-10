package com.procurement.agency.api;

import com.procurement.agency.application.AgencyFinanceService;
import com.procurement.agency.domain.AgencyFinanceRecords.*;
import com.procurement.common.api.ApiResponse;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/buyer/agency/packages/{pkg}/finance")
public record AgencyFinanceController(AgencyFinanceService service) {
  @GetMapping
  public ApiResponse<Workspace> workspace(@PathVariable String pkg) {
    return ApiResponse.ok(service.workspace(pkg));
  }

  @GetMapping("/expert-sources")
  public ApiResponse<java.util.List<AgencyFinanceService.ExpertSource>> experts(
      @PathVariable String pkg) {
    return ApiResponse.ok(service.expertSources(pkg));
  }

  @PutMapping("/categories/{code}")
  public ApiResponse<java.util.List<Category>> category(
      @PathVariable String pkg, @PathVariable String code, @RequestBody CategoryDraft d) {
    return ApiResponse.ok(service.configureCategory(pkg, code, d));
  }

  @PostMapping("/receivables")
  public ApiResponse<Account> fee(@PathVariable String pkg, @RequestBody Calculation d) {
    return ApiResponse.ok(service.receivable(pkg, d));
  }

  @PostMapping("/costs")
  public ApiResponse<Account> cost(@PathVariable String pkg, @RequestBody CostDraft d) {
    return ApiResponse.ok(service.cost(pkg, d));
  }

  @PostMapping("/accounts/{id}/submit")
  public ApiResponse<Account> submit(
      @PathVariable String pkg, @PathVariable String id, @RequestBody Submit d) {
    return ApiResponse.ok(service.submit(pkg, id, d));
  }

  public record Withdrawal(String reason) {}

  @PostMapping("/reviews/{id}/withdraw")
  public ApiResponse<Boolean> withdraw(
      @PathVariable String pkg, @PathVariable String id, @RequestBody Withdrawal d) {
    service.withdraw(pkg, id, d.reason());
    return ApiResponse.ok(true);
  }

  @PostMapping("/accounts/{id}/entries")
  public ApiResponse<Entry> entry(
      @PathVariable String pkg, @PathVariable String id, @RequestBody EntryDraft d) {
    return ApiResponse.ok(service.enter(pkg, id, d));
  }
}
