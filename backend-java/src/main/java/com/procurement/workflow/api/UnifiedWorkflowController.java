package com.procurement.workflow.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.workflow.application.UnifiedWorkflowApplicationService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/buyer/workflow")
public class UnifiedWorkflowController {
  private final UnifiedWorkflowApplicationService unifiedWorkflowApplicationService;

  public UnifiedWorkflowController(UnifiedWorkflowApplicationService unifiedWorkflowApplicationService) {
    this.unifiedWorkflowApplicationService = unifiedWorkflowApplicationService;
  }

  @GetMapping("/tasks")
  public ApiResponse<List<UnifiedWorkflowTaskResponse>> tasks() {
    return ApiResponse.ok(unifiedWorkflowApplicationService.listCurrentUserTasks());
  }

  @PostMapping("/tasks/{taskId}/complete")
  public ApiResponse<WorkflowInstanceHistoryResponse> complete(
      @PathVariable String taskId,
      @Valid @RequestBody CompleteWorkflowTaskRequest request) {
    return ApiResponse.ok(unifiedWorkflowApplicationService.completeCurrentUserTask(taskId, request));
  }

  @GetMapping("/instances/{workflowInstanceId}/history")
  public ApiResponse<WorkflowInstanceHistoryResponse> history(@PathVariable String workflowInstanceId) {
    return ApiResponse.ok(unifiedWorkflowApplicationService.getCurrentTenantHistory(workflowInstanceId));
  }

  @PostMapping("/instances/{workflowInstanceId}/withdraw-purchase-demand")
  public ApiResponse<Void> withdrawPurchaseDemand(@PathVariable String workflowInstanceId,
      @Valid @RequestBody WithdrawPurchaseDemandWorkflowRequest request) {
    unifiedWorkflowApplicationService.withdrawPurchaseDemand(workflowInstanceId, request.reason());
    return ApiResponse.ok(null);
  }

  @GetMapping("/instances/business/{businessType}/{businessId}/history")
  public ApiResponse<WorkflowInstanceHistoryResponse> businessHistory(
      @PathVariable String businessType,
      @PathVariable String businessId) {
    return ApiResponse.ok(
        unifiedWorkflowApplicationService.getCurrentTenantBusinessHistory(businessType, businessId));
  }

  @GetMapping("/instances/business/{businessType}/{businessId}/instances")
  public ApiResponse<WorkflowBusinessInstancePage> businessInstances(@PathVariable String businessType,
      @PathVariable String businessId, @RequestParam(defaultValue = "1") int page,
      @RequestParam(defaultValue = "10") int pageSize) {
    return ApiResponse.ok(unifiedWorkflowApplicationService.listCurrentTenantBusinessInstances(businessType, businessId, page, pageSize));
  }

  @GetMapping("/instances/page")
  public ApiResponse<WorkflowBusinessInstancePage> instancePage(
      @RequestParam(defaultValue = "pending") String view,
      @RequestParam(defaultValue = "1") int page,
      @RequestParam(defaultValue = "20") int pageSize,
      @RequestParam(defaultValue = "") String keyword) {
    return ApiResponse.ok(unifiedWorkflowApplicationService.pageCurrentTenantInstances(view, page, pageSize, keyword));
  }

  @GetMapping("/instances")
  public ApiResponse<List<WorkflowInstanceLedgerResponse>> instances(
      @RequestParam(defaultValue = "pending") String view,
      @RequestParam(defaultValue = "100") int limit) {
    return ApiResponse.ok(unifiedWorkflowApplicationService.listCurrentTenantInstances(view, limit));
  }

  @GetMapping("/definitions/{businessType}/form")
  public ApiResponse<WorkflowPublishedFormResponse> publishedForm(@PathVariable String businessType) {
    return ApiResponse.ok(unifiedWorkflowApplicationService.getPublishedForm(businessType));
  }
}
