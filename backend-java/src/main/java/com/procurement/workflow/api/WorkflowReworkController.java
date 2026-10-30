package com.procurement.workflow.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.workflow.application.WorkflowReworkService;
import com.procurement.workflow.application.UnifiedWorkflowApplicationService;
import com.procurement.workflow.domain.WorkflowAdditionalReview;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/buyer/workflow")
public class WorkflowReworkController {
  public record Additional(@NotBlank String reviewerId, @NotBlank @Size(max=1000) String reason) {}
  public record AdditionalDecision(@NotBlank String reviewId, @NotBlank String action, @NotBlank @Size(max=1000) String comment) {}
  public record Return(@NotBlank String targetNodeId, @NotBlank @Size(max=1000) String reason) {}
  public record Withdrawal(@NotBlank @Size(max=1000) String reason) {}
  private final WorkflowReworkService rework;
  private final UnifiedWorkflowApplicationService workflows;
  public WorkflowReworkController(WorkflowReworkService rework, UnifiedWorkflowApplicationService workflows) {
    this.rework=rework; this.workflows=workflows;
  }
  @GetMapping("/tasks/{taskId}/return-targets")
  public ApiResponse<List<WorkflowReworkService.ReturnTarget>> targets(@PathVariable String taskId) {
    return ApiResponse.ok(rework.returnTargets(taskId));
  }
  @PostMapping("/tasks/{taskId}/return")
  public ApiResponse<Void> returnTask(@PathVariable String taskId, @Valid @RequestBody Return request) {
    rework.returnTask(taskId, request.targetNodeId(), request.reason()); return ApiResponse.ok(null);
  }
  @PostMapping("/tasks/{taskId}/additional-reviews")
  public ApiResponse<WorkflowAdditionalReview> additional(@PathVariable String taskId, @Valid @RequestBody Additional request) {
    return ApiResponse.ok(rework.requestAdditional(taskId, request.reviewerId(), request.reason()));
  }
  @GetMapping("/tasks/{taskId}/additional-current")
  public ApiResponse<WorkflowAdditionalReview> currentAdditional(@PathVariable String taskId) {
    return ApiResponse.ok(rework.currentAdditional(taskId));
  }
  @PostMapping("/tasks/{taskId}/additional-decision")
  public ApiResponse<Void> decide(@PathVariable String taskId, @Valid @RequestBody AdditionalDecision request) {
    if (!List.of("approve","reject").contains(request.action())) throw new IllegalArgumentException("加审结论须为approve或reject");
    rework.completeAdditional(taskId, request.reviewId(), "approve".equals(request.action()), request.comment()); return ApiResponse.ok(null);
  }
  @GetMapping("/instances/{instanceId}/additional-reviews")
  public ApiResponse<List<WorkflowAdditionalReview>> additionalHistory(@PathVariable String instanceId) {
    return ApiResponse.ok(rework.additionalHistory(instanceId));
  }
  @PostMapping("/instances/{instanceId}/withdraw-ludong-application")
  public ApiResponse<Void> withdraw(@PathVariable String instanceId, @Valid @RequestBody Withdrawal request) {
    workflows.withdrawLudongApplication(instanceId, request.reason()); return ApiResponse.ok(null);
  }
}
