package com.procurement.process.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.process.application.ProcessInstanceApplicationService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/buyer/process-instances")
public class ProcessInstanceController {
  private final ProcessInstanceApplicationService processInstanceApplicationService;

  public ProcessInstanceController(
      ProcessInstanceApplicationService processInstanceApplicationService) {
    this.processInstanceApplicationService = processInstanceApplicationService;
  }

  @GetMapping
  public ApiResponse<List<ProcessInstanceResponse>> list(@RequestParam String processId) {
    return ApiResponse.ok(processInstanceApplicationService.listByProcess(processId));
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<ProcessInstanceResponse> start(
      @Valid @RequestBody StartProcessInstanceRequest request) {
    return ApiResponse.ok(processInstanceApplicationService.start(request));
  }

  @PostMapping("/{id}/review")
  public ApiResponse<ProcessInstanceResponse> review(
      @PathVariable String id,
      @Valid @RequestBody ReviewProcessInstanceRequest request) {
    return ApiResponse.ok(processInstanceApplicationService.review(id, request));
  }
}
