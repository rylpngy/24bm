package com.procurement.platform.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.platform.application.BillingApplicationService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/platform/tenants")
public class PlatformBillingController {
  private final BillingApplicationService billingApplicationService;

  public PlatformBillingController(BillingApplicationService billingApplicationService) {
    this.billingApplicationService = billingApplicationService;
  }

  @GetMapping("/{tenantId}/usage")
  public ApiResponse<TenantUsageResponse> usage(@PathVariable String tenantId) {
    return ApiResponse.ok(billingApplicationService.usageForTenant(tenantId));
  }

  @GetMapping("/{tenantId}/billing-statements")
  public ApiResponse<List<BillingStatementResponse>> statements(@PathVariable String tenantId) {
    return ApiResponse.ok(billingApplicationService.listStatements(tenantId));
  }

  // 生成当期账单(period 缺省为当月,格式 yyyy-MM)。
  @PostMapping("/{tenantId}/billing-statements")
  public ApiResponse<BillingStatementResponse> generateStatement(
      @PathVariable String tenantId, @RequestParam(required = false) String period) {
    return ApiResponse.ok(billingApplicationService.generateStatement(tenantId, period));
  }

  @PostMapping("/{tenantId}/billing-statements/{statementId}/issue")
  public ApiResponse<BillingStatementResponse> issueStatement(
      @PathVariable String tenantId, @PathVariable String statementId) {
    return ApiResponse.ok(billingApplicationService.issueStatement(tenantId, statementId));
  }

  @PostMapping("/{tenantId}/billing-statements/{statementId}/pay")
  public ApiResponse<BillingStatementResponse> payStatement(
      @PathVariable String tenantId, @PathVariable String statementId) {
    return ApiResponse.ok(billingApplicationService.payStatement(tenantId, statementId));
  }
}
