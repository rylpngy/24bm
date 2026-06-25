package com.procurement.workflow.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.workflow.application.FlowableDemandApprovalService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// 采购需求审批的 Flowable 工作流入口(引擎驱动,区别于固定审批模板)。
@RestController
@RequestMapping("/api/v1/buyer/workflow/demand-approvals")
public class FlowableDemandApprovalController {
  private final FlowableDemandApprovalService service;

  public FlowableDemandApprovalController(FlowableDemandApprovalService service) {
    this.service = service;
  }

  @PostMapping("/{demandId}/start")
  public ApiResponse<StartProcessResponse> start(@PathVariable String demandId) {
    return ApiResponse.ok(service.start(demandId));
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

  @GetMapping("/{demandId}/outcome")
  public ApiResponse<String> outcome(@PathVariable String demandId) {
    return ApiResponse.ok(service.outcome(demandId));
  }
}
