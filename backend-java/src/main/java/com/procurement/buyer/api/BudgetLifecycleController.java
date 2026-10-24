package com.procurement.buyer.api;

import com.procurement.buyer.api.BudgetContracts.*;
import com.procurement.buyer.application.BudgetLifecycleService;
import com.procurement.buyer.domain.BudgetChange;
import com.procurement.buyer.domain.BudgetPosition;
import com.procurement.common.api.ApiResponse;
import com.procurement.common.excel.ExcelDownloads;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/buyer/budgets")
public class BudgetLifecycleController {
  private final BudgetLifecycleService service;
  public BudgetLifecycleController(BudgetLifecycleService service) { this.service=service; }
  @GetMapping("/positions") public ApiResponse<List<BudgetPosition>> positions() { return ApiResponse.ok(service.positions()); }
  @GetMapping("/departments") public ApiResponse<List<BudgetDepartment>> departments() { return ApiResponse.ok(service.departments()); }
  @GetMapping("/policy") public ApiResponse<BudgetPolicy> policy() { return ApiResponse.ok(service.policy()); }
  @PutMapping("/policy") public ApiResponse<BudgetPolicy> policy(@Valid @RequestBody BudgetPolicyUpdate request) { return ApiResponse.ok(service.updatePolicy(request)); }
  @GetMapping("/requests") public ApiResponse<BudgetChangePage> requests(@RequestParam(defaultValue="") String kind,
      @RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="20") int pageSize) { return ApiResponse.ok(service.requests(kind,page,pageSize)); }
  @GetMapping("/requests/{id}") public ApiResponse<BudgetChange> request(@PathVariable String id) { return ApiResponse.ok(service.request(id)); }
  @PostMapping("/requests") public ApiResponse<BudgetChange> create(@Valid @RequestBody BudgetDraft request) { return ApiResponse.ok(service.create(request)); }
  @PutMapping("/requests/{id}") public ApiResponse<BudgetChange> edit(@PathVariable String id,@Valid @RequestBody BudgetDraft request) { return ApiResponse.ok(service.edit(id,request)); }
  @PostMapping("/requests/{id}/submit") public ApiResponse<BudgetChange> submit(@PathVariable String id,@RequestBody(required=false) BudgetSubmission request) {
    return ApiResponse.ok(service.submit(id,request==null?java.util.Map.of():request.formData()));
  }
  @PostMapping("/requests/{id}/withdraw") public ApiResponse<BudgetChange> withdraw(@PathVariable String id,@Valid @RequestBody BudgetAction request) { return ApiResponse.ok(service.withdraw(id,request.reason())); }
  @GetMapping("/ledger") public ApiResponse<BudgetLedgerPage> ledger(@RequestParam(defaultValue="") String departmentId,
      @RequestParam(defaultValue="") String period,@RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="20") int pageSize) {
    return ApiResponse.ok(service.ledger(departmentId,period,page,pageSize));
  }
  @GetMapping("/ledger/export") public org.springframework.http.ResponseEntity<org.springframework.core.io.ByteArrayResource> export(
      @RequestParam(defaultValue="") String departmentId,@RequestParam(defaultValue="") String period) {
    return ExcelDownloads.xlsx("预算占用台账.xlsx",service.export(departmentId,period));
  }
  @GetMapping("/unassigned-orders") public ApiResponse<BudgetUnassignedPage> unassigned(@RequestParam(defaultValue="1") int page,
      @RequestParam(defaultValue="20") int pageSize) { return ApiResponse.ok(service.unassigned(page,pageSize)); }
  @PostMapping("/unassigned-orders/{id}/assign") public ApiResponse<Void> assign(@PathVariable String id,@Valid @RequestBody BudgetAssignment request) {
    service.assignOrder(id,request);return ApiResponse.ok(null);
  }
}
