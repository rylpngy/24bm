package com.procurement.process.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.application.PermissionService;
import com.procurement.process.api.CreateProcessDefinitionRequest;
import com.procurement.process.api.ProcessDefinitionResponse;
import com.procurement.process.api.ProcessDefinitionVersionResponse;
import com.procurement.process.api.UpdateProcessDefinitionRequest;
import com.procurement.process.domain.ProcessDefinition;
import com.procurement.process.domain.ProcessDefinitionStatus;
import com.procurement.process.infrastructure.ProcessDefinitionMapper;
import com.procurement.workflow.application.WorkflowDefinitionPublicationService;
import com.procurement.workflow.definition.WorkflowBusinessTypeCatalog;
import com.procurement.workflow.domain.WorkflowDefinitionVersion;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// 流程引擎:审批流程定义的增改查。表单/流程 schema 为前端拥有的 JSON,后端整体存取。
@Service
public class ProcessDefinitionApplicationService {
  private final ProcessDefinitionMapper processDefinitionMapper;
  private final AuditLogApplicationService auditLogApplicationService;
  private final WorkflowDefinitionPublicationService workflowDefinitionPublicationService;
  private final PermissionService permissionService;

  public ProcessDefinitionApplicationService(
      ProcessDefinitionMapper processDefinitionMapper,
      AuditLogApplicationService auditLogApplicationService,
      WorkflowDefinitionPublicationService workflowDefinitionPublicationService,
      PermissionService permissionService) {
    this.processDefinitionMapper = processDefinitionMapper;
    this.auditLogApplicationService = auditLogApplicationService;
    this.workflowDefinitionPublicationService = workflowDefinitionPublicationService;
    this.permissionService = permissionService;
  }

  public List<ProcessDefinitionResponse> listCurrentTenantProcesses() {
    String tenantId = TenantAccessGuard.requireTenantId("buyer process APIs");
    permissionService.require("buyer:workflow:manage");
    return processDefinitionMapper.listByTenant(tenantId).stream().map(this::toResponse).toList();
  }

  public ProcessDefinitionResponse getProcess(String id) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer process APIs");
    permissionService.require("buyer:workflow:manage");
    return toResponse(requireProcess(tenantId, id));
  }

  @Transactional
  public ProcessDefinitionResponse createProcess(CreateProcessDefinitionRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer process APIs");
    permissionService.require("buyer:workflow:manage");
    if (request.businessType() != null && !request.businessType().isBlank()) {
      WorkflowBusinessTypeCatalog.requireSupported(request.businessType());
      requireNoOtherProcessForBusinessType(tenantId, request.businessType(), null);
    }
    String id = "proc-" + UUID.randomUUID();
    processDefinitionMapper.insert(
        id,
        tenantId,
        request.name(),
        request.description() == null ? "" : request.description(),
        request.icon() == null || request.icon().isBlank() ? "file" : request.icon(),
        blankToNull(request.businessType()));
    auditLogApplicationService.recordTenantAction("process.created", "process", id);
    return toResponse(requireProcess(tenantId, id));
  }

  @Transactional
  public ProcessDefinitionResponse updateProcess(String id, UpdateProcessDefinitionRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer process APIs");
    permissionService.require("buyer:workflow:manage");
    ProcessDefinition current = requireProcess(tenantId, id);
    String requestedBusinessType = blankToNull(request.businessType());
    String businessType = requestedBusinessType == null ? current.businessType() : requestedBusinessType;
    if (businessType != null) {
      WorkflowBusinessTypeCatalog.requireSupported(businessType);
      requireNoOtherProcessForBusinessType(tenantId, businessType, id);
    }
    if (current.activeVersionId() != null && !java.util.Objects.equals(current.businessType(), businessType)) {
      throw new IllegalStateException("A published workflow cannot change businessType; create a new definition instead");
    }
    if (ProcessDefinitionStatus.ENABLED.equals(request.status())) {
      throw new IllegalArgumentException("Use the publish endpoint to enable a workflow version");
    }
    if (!ProcessDefinitionStatus.DRAFT.equals(request.status())
        && !ProcessDefinitionStatus.DISABLED.equals(request.status())) {
      throw new IllegalArgumentException("Workflow definition status must be draft or disabled when saving");
    }
    String persistedStatus = current.activeVersionId() == null
        ? request.status()
        : ProcessDefinitionStatus.ENABLED;
    int updated = processDefinitionMapper.update(
        tenantId,
        id,
        request.name(),
        request.description() == null ? "" : request.description(),
        persistedStatus,
        businessType,
        request.formSchema(),
        request.flowSchema());
    if (updated == 0) {
      throw new IllegalStateException("Process changed before update could be recorded: " + id);
    }
    if (ProcessDefinitionStatus.DISABLED.equals(request.status())) {
      workflowDefinitionPublicationService.disableCurrentTenantProcess(id);
    }
    String detail = current.status().equals(persistedStatus)
        ? "流程「" + request.name() + "」配置已保存"
        : "流程「" + request.name() + "」状态: " + current.status() + " → " + persistedStatus;
    auditLogApplicationService.recordTenantAction(
        tenantId, "process.updated", "process", id, detail);
    return toResponse(requireProcess(tenantId, id));
  }

  @Transactional
  public ProcessDefinitionResponse publishProcess(String id) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer process APIs");
    workflowDefinitionPublicationService.publishCurrentTenantProcess(id);
    return toResponse(requireProcess(tenantId, id));
  }

  public List<ProcessDefinitionVersionResponse> listProcessVersions(String id) {
    return workflowDefinitionPublicationService.listCurrentTenantVersions(id).stream()
        .map(this::toVersionResponse)
        .toList();
  }

  private ProcessDefinition requireProcess(String tenantId, String id) {
    ProcessDefinition process = processDefinitionMapper.findByTenantAndId(tenantId, id);
    if (process == null) {
      throw new IllegalArgumentException("Process not found in tenant scope: " + id);
    }
    return process;
  }

  // 一个业务类型只有一个配置入口；后续发布在该定义上产生不可变版本，避免出现多个“启用中”的歧义。
  private void requireNoOtherProcessForBusinessType(
      String tenantId, String businessType, String currentProcessId) {
    ProcessDefinition existing = processDefinitionMapper.findByTenantAndBusinessType(tenantId, businessType);
    if (existing != null && !existing.id().equals(currentProcessId)) {
      throw new IllegalStateException(
          "A workflow definition already exists for business type: " + businessType
              + "; update the existing definition instead");
    }
  }

  private ProcessDefinitionResponse toResponse(ProcessDefinition p) {
    return new ProcessDefinitionResponse(
        p.id(), p.name(), p.description(), p.icon(), p.status(), p.businessType(), p.activeVersionId(),
        p.formSchema(), p.flowSchema(), p.publishedAt(), p.updatedAt());
  }

  private ProcessDefinitionVersionResponse toVersionResponse(
      WorkflowDefinitionVersion version) {
    return new ProcessDefinitionVersionResponse(
        version.id(),
        version.businessType(),
        version.versionNo(),
        version.status(),
        version.flowableProcessDefinitionId(),
        version.publishedAt(),
        version.publishedBy());
  }

  private static String blankToNull(String value) {
    return value == null || value.isBlank() ? null : value.trim();
  }
}
