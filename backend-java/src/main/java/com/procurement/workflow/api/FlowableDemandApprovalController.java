package com.procurement.workflow.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.workflow.application.FlowableDemandApprovalService;
import jakarta.validation.Valid;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

// Flowable 通用业务审批入口(引擎驱动,接管全部审批类型 + 按金额二级会签)。
@RestController
@RequestMapping("/api/v1/buyer/workflow/approvals")
public class FlowableDemandApprovalController {
  private final FlowableDemandApprovalService service;

  public FlowableDemandApprovalController(FlowableDemandApprovalService service) {
    this.service = service;
  }

  @PostMapping("/{bizId}/start")
  public ApiResponse<StartProcessResponse> start(
      @PathVariable String bizId,
      @RequestParam(defaultValue = "purchase_demand") String bizType,
      @RequestParam(defaultValue = "0") BigDecimal amount) {
    return ApiResponse.ok(service.start(bizType, bizId, amount));
  }

  @GetMapping("/tasks")
  public ApiResponse<List<WorkflowTaskResponse>> tasks() {
    return ApiResponse.ok(service.listPendingTasks());
  }

  @PostMapping("/tasks/{taskId}/complete")
  public ApiResponse<Void> complete(
      @PathVariable String taskId, @Valid @RequestBody CompleteApprovalRequest request) {
    service.complete(taskId, request);
    return ApiResponse.ok(null);
  }

  @GetMapping("/{bizId}/outcome")
  public ApiResponse<String> outcome(@PathVariable String bizId) {
    return ApiResponse.ok(service.outcome(bizId));
  }
}
