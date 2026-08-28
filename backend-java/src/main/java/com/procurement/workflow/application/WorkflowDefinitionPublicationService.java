package com.procurement.workflow.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.approval.domain.ApprovalTemplate;
import com.procurement.approval.domain.ApprovalTemplateCode;
import com.procurement.approval.infrastructure.ApprovalTemplateMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.application.PermissionService;
import com.procurement.process.domain.ProcessDefinition;
import com.procurement.process.domain.ProcessDefinitionStatus;
import com.procurement.process.infrastructure.ProcessDefinitionMapper;
import com.procurement.workflow.definition.CompiledWorkflowBpmn;
import com.procurement.workflow.definition.FlowableProcessCompiler;
import com.procurement.workflow.definition.WorkflowBusinessTypeCatalog;
import com.procurement.workflow.definition.WorkflowDefinitionSchema;
import com.procurement.workflow.definition.WorkflowSchemaValidator;
import com.procurement.workflow.domain.WorkflowDefinitionVersion;
import com.procurement.workflow.domain.WorkflowDefinitionVersionStatus;
import com.procurement.workflow.infrastructure.WorkflowDefinitionVersionMapper;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.flowable.engine.RepositoryService;
import org.flowable.engine.repository.Deployment;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// 流程发布门面：草稿先结构校验，再生成 BPMN 并部署到 Flowable，最后写不可变版本快照。
@Service
public class WorkflowDefinitionPublicationService {
  private final ProcessDefinitionMapper processDefinitionMapper;
  private final WorkflowDefinitionVersionMapper workflowDefinitionVersionMapper;
  private final WorkflowSchemaValidator workflowSchemaValidator;
  private final FlowableProcessCompiler flowableProcessCompiler;
  private final RepositoryService repositoryService;
  private final ApprovalTemplateMapper approvalTemplateMapper;
  private final AuditLogApplicationService auditLogApplicationService;
  private final PermissionService permissionService;
  private final ObjectMapper objectMapper;

  public WorkflowDefinitionPublicationService(
      ProcessDefinitionMapper processDefinitionMapper,
      WorkflowDefinitionVersionMapper workflowDefinitionVersionMapper,
      WorkflowSchemaValidator workflowSchemaValidator,
      FlowableProcessCompiler flowableProcessCompiler,
      RepositoryService repositoryService,
      ApprovalTemplateMapper approvalTemplateMapper,
      AuditLogApplicationService auditLogApplicationService,
      PermissionService permissionService,
      ObjectMapper objectMapper) {
    this.processDefinitionMapper = processDefinitionMapper;
    this.workflowDefinitionVersionMapper = workflowDefinitionVersionMapper;
    this.workflowSchemaValidator = workflowSchemaValidator;
    this.flowableProcessCompiler = flowableProcessCompiler;
    this.repositoryService = repositoryService;
    this.approvalTemplateMapper = approvalTemplateMapper;
    this.auditLogApplicationService = auditLogApplicationService;
    this.permissionService = permissionService;
    this.objectMapper = objectMapper;
  }

  @Transactional
  public WorkflowDefinitionVersion publishCurrentTenantProcess(String processDefinitionId) {
    String tenantId = TenantAccessGuard.requireTenantId("workflow definition APIs");
    String userId = TenantAccessGuard.requireUserId("workflow definition APIs");
    permissionService.require("buyer:workflow:manage");
    return publish(tenantId, userId, requireProcess(tenantId, processDefinitionId));
  }

  public List<WorkflowDefinitionVersion> listCurrentTenantVersions(String processDefinitionId) {
    String tenantId = TenantAccessGuard.requireTenantId("workflow definition APIs");
    permissionService.require("buyer:workflow:manage");
    requireProcess(tenantId, processDefinitionId);
    return workflowDefinitionVersionMapper.listByTenantAndProcessDefinition(tenantId, processDefinitionId);
  }

  public WorkflowDefinitionVersion findPublishedVersion(String tenantId, String businessType) {
    WorkflowBusinessTypeCatalog.requireSupported(businessType);
    return workflowDefinitionVersionMapper.findPublishedByTenantAndBusinessType(tenantId, businessType);
  }

  // 兼容已有审批模板：首次使用某业务类型但还未进入可视化配置器时，生成一次受控的单角色默认版本。
  // 它同样走 BPMN 部署和版本表，之后由人工发布的定义覆盖，不会写入旧 approval_tasks。
  @Transactional
  public WorkflowDefinitionVersion requirePublishedVersion(
      String tenantId, String businessType, String actorId) {
    WorkflowBusinessTypeCatalog.requireSupported(businessType);
    WorkflowDefinitionVersion current = findPublishedVersion(tenantId, businessType);
    if (current != null) {
      return current;
    }
    ProcessDefinition existing = processDefinitionMapper.findByTenantAndBusinessType(tenantId, businessType);
    if (existing != null) {
      throw new IllegalStateException(
          "Workflow definition exists but no version is published for business type: " + businessType);
    }
    ApprovalTemplate template = approvalTemplateMapper.findByTenantAndCode(
        tenantId, ApprovalTemplateCode.requireByBusinessType(businessType));
    if (template == null || template.defaultApproverRoleId() == null
        || template.defaultApproverRoleId().isBlank()) {
      throw new IllegalStateException(
          "No published workflow and no compatible approval role for business type: " + businessType);
    }
    String definitionId = "proc-compat-" + UUID.randomUUID();
    String name = "系统默认审批 · " + workflowName(businessType);
    processDefinitionMapper.insert(
        definitionId, tenantId, name, "由既有审批角色迁移生成；请在流程定义中按需发布新版本。", "file-text", businessType);
    String formSchema = "{\"fields\":[]}";
    String flowSchema = compatibilityFlow(template.defaultApproverRoleId());
    processDefinitionMapper.update(
        tenantId,
        definitionId,
        name,
        "由既有审批角色迁移生成；请在流程定义中按需发布新版本。",
        ProcessDefinitionStatus.DRAFT,
        businessType,
        formSchema,
        flowSchema);
    return publish(tenantId, actorId, requireProcess(tenantId, definitionId));
  }

  @Transactional
  public void disableCurrentTenantProcess(String processDefinitionId) {
    String tenantId = TenantAccessGuard.requireTenantId("workflow definition APIs");
    permissionService.require("buyer:workflow:manage");
    ProcessDefinition definition = requireProcess(tenantId, processDefinitionId);
    if (definition.businessType() != null && !definition.businessType().isBlank()) {
      workflowDefinitionVersionMapper.supersedePublishedByBusinessType(tenantId, definition.businessType());
    }
    processDefinitionMapper.disable(tenantId, processDefinitionId);
    auditLogApplicationService.recordTenantAction(
        tenantId, "workflow.definition_disabled", "process_definition", processDefinitionId,
        "流程定义已停用，不再允许新业务实例发起");
  }

  private WorkflowDefinitionVersion publish(
      String tenantId, String actorId, ProcessDefinition definition) {
    ProcessDefinition lockedDefinition = processDefinitionMapper.findByTenantAndIdForUpdate(
        tenantId, definition.id());
    if (lockedDefinition == null) {
      throw new IllegalArgumentException("Process definition not found in tenant scope: " + definition.id());
    }
    definition = lockedDefinition;
    String businessType = definition.businessType();
    if (businessType == null || businessType.isBlank()) {
      throw new IllegalArgumentException("Process definition businessType is required before publication");
    }
    WorkflowBusinessTypeCatalog.requireSupported(businessType);
    WorkflowDefinitionSchema schema = workflowSchemaValidator.validate(
        tenantId, definition.formSchema(), definition.flowSchema());
    int versionNo = workflowDefinitionVersionMapper.nextVersionNo(tenantId, definition.id());
    CompiledWorkflowBpmn compiled = flowableProcessCompiler.compile(
        definition.id(), businessType, versionNo, definition.name(), schema, tenantId);
    Deployment deployment = repositoryService.createDeployment()
        .name("24Bid " + definition.name() + " v" + versionNo)
        .tenantId(tenantId)
        .addBytes(compiled.processKey() + ".bpmn20.xml", compiled.bpmnXml())
        .deploy();
    org.flowable.engine.repository.ProcessDefinition flowableDefinition = repositoryService
        .createProcessDefinitionQuery()
        .deploymentId(deployment.getId())
        .processDefinitionKey(compiled.processKey())
        .singleResult();
    if (flowableDefinition == null) {
      throw new IllegalStateException("Flowable deployment did not produce a process definition");
    }

    String versionId = "workflow-def-v" + UUID.randomUUID();
    workflowDefinitionVersionMapper.supersedePublishedByBusinessType(tenantId, businessType);
    workflowDefinitionVersionMapper.insert(
        versionId,
        tenantId,
        definition.id(),
        businessType,
        versionNo,
        WorkflowDefinitionVersionStatus.PUBLISHED,
        definition.formSchema(),
        definition.flowSchema(),
        compiled.processKey(),
        flowableDefinition.getId(),
        deployment.getId(),
        actorId);
    processDefinitionMapper.markPublished(tenantId, definition.id(), versionId, actorId);
    auditLogApplicationService.recordTenantAction(
        tenantId,
        "workflow.definition_published",
        "process_definition",
        definition.id(),
        "业务类型 " + businessType + " 已发布流程版本 v" + versionNo);
    return workflowDefinitionVersionMapper.findByTenantAndId(tenantId, versionId);
  }

  private ProcessDefinition requireProcess(String tenantId, String id) {
    ProcessDefinition process = processDefinitionMapper.findByTenantAndId(tenantId, id);
    if (process == null) {
      throw new IllegalArgumentException("Process definition not found in tenant scope: " + id);
    }
    return process;
  }

  private String compatibilityFlow(String roleId) {
    try {
      Map<String, Object> assignment = Map.of("type", "role", "roleId", roleId);
      Map<String, Object> step = new LinkedHashMap<>();
      step.put("id", "compat_approver");
      step.put("type", "approver");
      step.put("title", "审批");
      step.put("assignment", assignment);
      return objectMapper.writeValueAsString(Map.of("steps", List.of(step)));
    } catch (Exception exception) {
      throw new IllegalStateException("Cannot create compatible workflow definition", exception);
    }
  }

  private static String workflowName(String businessType) {
    return switch (businessType) {
      case "purchase_demand" -> "采购需求";
      case "buyer_supplier_admission" -> "供应商准入";
      case "rfq_award" -> "询价定标";
      case "contract_approval" -> "合同";
      case "payment_request" -> "付款申请";
      case "payment_batch" -> "付款批次";
      case "payment_archive_exception" -> "付款归档例外";
      default -> businessType;
    };
  }
}
