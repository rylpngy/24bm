package com.procurement.process.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.process.api.CreateProcessDefinitionRequest;
import com.procurement.process.api.ProcessDefinitionResponse;
import com.procurement.process.api.UpdateProcessDefinitionRequest;
import com.procurement.process.domain.ProcessDefinition;
import com.procurement.process.infrastructure.ProcessDefinitionMapper;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// 流程引擎:审批流程定义的增改查。表单/流程 schema 为前端拥有的 JSON,后端整体存取。
@Service
public class ProcessDefinitionApplicationService {
  private final ProcessDefinitionMapper processDefinitionMapper;
  private final AuditLogApplicationService auditLogApplicationService;

  public ProcessDefinitionApplicationService(
      ProcessDefinitionMapper processDefinitionMapper,
      AuditLogApplicationService auditLogApplicationService) {
    this.processDefinitionMapper = processDefinitionMapper;
    this.auditLogApplicationService = auditLogApplicationService;
  }

  public List<ProcessDefinitionResponse> listCurrentTenantProcesses() {
    String tenantId = TenantAccessGuard.requireTenantId("buyer process APIs");
    return processDefinitionMapper.listByTenant(tenantId).stream().map(this::toResponse).toList();
  }

  public ProcessDefinitionResponse getProcess(String id) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer process APIs");
    return toResponse(requireProcess(tenantId, id));
  }

  @Transactional
  public ProcessDefinitionResponse createProcess(CreateProcessDefinitionRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer process APIs");
    String id = "proc-" + UUID.randomUUID();
    processDefinitionMapper.insert(
        id,
        tenantId,
        request.name(),
        request.description() == null ? "" : request.description(),
        request.icon() == null || request.icon().isBlank() ? "file" : request.icon());
    auditLogApplicationService.recordTenantAction("process.created", "process", id);
    return toResponse(requireProcess(tenantId, id));
  }

  @Transactional
  public ProcessDefinitionResponse updateProcess(String id, UpdateProcessDefinitionRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer process APIs");
    ProcessDefinition current = requireProcess(tenantId, id);
    int updated = processDefinitionMapper.update(
        tenantId,
        id,
        request.name(),
        request.description() == null ? "" : request.description(),
        request.status(),
        request.formSchema(),
        request.flowSchema());
    if (updated == 0) {
      throw new IllegalStateException("Process changed before update could be recorded: " + id);
    }
    String detail = current.status().equals(request.status())
        ? "流程「" + request.name() + "」配置已保存"
        : "流程「" + request.name() + "」状态: " + current.status() + " → " + request.status();
    auditLogApplicationService.recordTenantAction(
        tenantId, "process.updated", "process", id, detail);
    return toResponse(requireProcess(tenantId, id));
  }

  private ProcessDefinition requireProcess(String tenantId, String id) {
    ProcessDefinition process = processDefinitionMapper.findByTenantAndId(tenantId, id);
    if (process == null) {
      throw new IllegalArgumentException("Process not found in tenant scope: " + id);
    }
    return process;
  }

  private ProcessDefinitionResponse toResponse(ProcessDefinition p) {
    return new ProcessDefinitionResponse(
        p.id(), p.name(), p.description(), p.icon(), p.status(),
        p.formSchema(), p.flowSchema(), p.updatedAt());
  }
}
