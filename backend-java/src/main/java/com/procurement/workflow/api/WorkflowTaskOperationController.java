package com.procurement.workflow.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.workflow.application.WorkflowTaskOperationService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/buyer/workflow")
public class WorkflowTaskOperationController {
  private final WorkflowTaskOperationService operations;
  public WorkflowTaskOperationController(WorkflowTaskOperationService operations) { this.operations = operations; }

  @GetMapping("/tasks/{taskId}/recipients")
  public ApiResponse<List<WorkflowTaskOperationService.Recipient>> recipients(@PathVariable String taskId) {
    return ApiResponse.ok(operations.recipients(taskId));
  }
  @GetMapping("/tasks/{taskId}/timing")
  public ApiResponse<WorkflowTaskOperationService.TaskTiming> timing(@PathVariable String taskId) {
    return ApiResponse.ok(operations.timing(taskId));
  }
  @PostMapping("/tasks/{taskId}/operations")
  public ApiResponse<Void> operate(@PathVariable String taskId, @Valid @RequestBody WorkflowTaskOperationRequest request) {
    operations.operate(taskId, request);
    return ApiResponse.ok(null);
  }

  public record Reminder(@jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max=1000) String reason) {}
  @PostMapping("/instances/{instanceId}/remind")
  public ApiResponse<Void> remind(@PathVariable String instanceId, @Valid @RequestBody Reminder request) {
    operations.remindInstance(instanceId, request.reason());
    return ApiResponse.ok(null);
  }
}
