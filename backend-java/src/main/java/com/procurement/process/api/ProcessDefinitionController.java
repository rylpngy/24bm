package com.procurement.process.api;

import com.procurement.common.api.ApiResponse;
import com.procurement.process.application.ProcessDefinitionApplicationService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/buyer/process-definitions")
public class ProcessDefinitionController {
  private final ProcessDefinitionApplicationService processDefinitionApplicationService;

  public ProcessDefinitionController(
      ProcessDefinitionApplicationService processDefinitionApplicationService) {
    this.processDefinitionApplicationService = processDefinitionApplicationService;
  }

  @GetMapping
  public ApiResponse<List<ProcessDefinitionResponse>> list() {
    return ApiResponse.ok(processDefinitionApplicationService.listCurrentTenantProcesses());
  }

  @GetMapping("/{id}")
  public ApiResponse<ProcessDefinitionResponse> get(@PathVariable String id) {
    return ApiResponse.ok(processDefinitionApplicationService.getProcess(id));
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  public ApiResponse<ProcessDefinitionResponse> create(
      @Valid @RequestBody CreateProcessDefinitionRequest request) {
    return ApiResponse.ok(processDefinitionApplicationService.createProcess(request));
  }

  @PutMapping("/{id}")
  public ApiResponse<ProcessDefinitionResponse> update(
      @PathVariable String id,
      @Valid @RequestBody UpdateProcessDefinitionRequest request) {
    return ApiResponse.ok(processDefinitionApplicationService.updateProcess(id, request));
  }
}
