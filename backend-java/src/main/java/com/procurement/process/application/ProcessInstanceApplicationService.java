package com.procurement.process.application;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.approval.application.ApprovalTaskApplicationService;
import com.procurement.approval.domain.ApprovalStatus;
import com.procurement.approval.domain.ApprovalTask;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.process.api.ProcessInstanceResponse;
import com.procurement.process.api.ReviewProcessInstanceRequest;
import com.procurement.process.api.StartProcessInstanceRequest;
import com.procurement.process.domain.FlowEvaluator;
import com.procurement.process.domain.ProcessDefinitionStatus;
import com.procurement.process.domain.ProcessInstance;
import com.procurement.process.domain.ResolvedStep;
import com.procurement.process.infrastructure.ProcessDefinitionMapper;
import com.procurement.process.infrastructure.ProcessInstanceMapper;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// 流程实例生命周期:发起(按表单解析审批路径 + 建首个审批任务)、审批(推进/驳回 + 推进任务)、列表。
// 与现有审批引擎打通:审批节点用 approval_tasks(biz_type='process_instance')进 审批中心。
@Service
public class ProcessInstanceApplicationService {
  public static final String BIZ_TYPE = "process_instance";
  private static final ObjectMapper OBJECT_MAPPER =
      new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
  private static final TypeReference<Map<String, String>> FORM_TYPE = new TypeReference<>() {};

  private final ProcessInstanceMapper processInstanceMapper;
  private final ProcessDefinitionMapper processDefinitionMapper;
  private final ApprovalTaskApplicationService approvalTaskApplicationService;
  private final AuditLogApplicationService auditLogApplicationService;

  public ProcessInstanceApplicationService(
      ProcessInstanceMapper processInstanceMapper,
      ProcessDefinitionMapper processDefinitionMapper,
      ApprovalTaskApplicationService approvalTaskApplicationService,
      AuditLogApplicationService auditLogApplicationService) {
    this.processInstanceMapper = processInstanceMapper;
    this.processDefinitionMapper = processDefinitionMapper;
    this.approvalTaskApplicationService = approvalTaskApplicationService;
    this.auditLogApplicationService = auditLogApplicationService;
  }

  public List<ProcessInstanceResponse> listByProcess(String processId) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer process APIs");
    return processInstanceMapper.listByTenantAndProcess(tenantId, processId).stream()
        .map(this::toResponse)
        .toList();
  }

  @Transactional
  public ProcessInstanceResponse start(StartProcessInstanceRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer process APIs");
    String userId = TenantAccessGuard.requireUserId("buyer process APIs");
    var process = processDefinitionMapper.findByTenantAndId(tenantId, request.processId());
    if (process == null) {
      throw new IllegalArgumentException("Process not found in tenant scope: " + request.processId());
    }
    if (!ProcessDefinitionStatus.ENABLED.equals(process.status())) {
      throw new IllegalStateException("Only enabled processes can be started: " + request.processId());
    }
    Map<String, String> formValues = parseForm(request.formData());
    List<ResolvedStep> path = FlowEvaluator.evaluate(process.flowSchema(), formValues);
    long approverCount = path.stream().filter(ResolvedStep::isApprover).count();

    String instanceId = "pi-" + UUID.randomUUID();
    String status = approverCount == 0 ? "approved" : "processing";
    processInstanceMapper.insert(
        instanceId, tenantId, request.processId(), process.name(), request.amount(),
        request.formData(), writeJson(path), 0, status, userId);

    if (approverCount > 0) {
      approvalTaskApplicationService.createGenericPendingTask(tenantId, BIZ_TYPE, instanceId, null);
    }
    auditLogApplicationService.recordTenantAction(
        tenantId, "process_instance.started", "process", instanceId,
        "发起流程「" + process.name() + "」");
    return toResponse(processInstanceMapper.findByTenantAndId(tenantId, instanceId));
  }

  @Transactional
  public ProcessInstanceResponse review(String instanceId, ReviewProcessInstanceRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("buyer process APIs");
    ProcessInstance instance = processInstanceMapper.findByTenantAndId(tenantId, instanceId);
    if (instance == null) {
      throw new IllegalArgumentException("Process instance not found: " + instanceId);
    }
    if (!"processing".equals(instance.status())) {
      throw new IllegalStateException("Only processing instances can be reviewed: " + instanceId);
    }
    ApprovalTask task = approvalTaskApplicationService.findPendingTask(tenantId, BIZ_TYPE, instanceId);
    if (task == null) {
      throw new IllegalStateException("No pending approval task for instance: " + instanceId);
    }
    boolean approve = "approve".equalsIgnoreCase(request.decision());
    List<ResolvedStep> approvers = readPath(instance.resolvedPath()).stream()
        .filter(ResolvedStep::isApprover).toList();

    if (!approve) {
      approvalTaskApplicationService.completeTask(tenantId, task.id(), ApprovalStatus.REJECTED, request.comment());
      processInstanceMapper.updateProgress(tenantId, instanceId, instance.currentIndex(), "rejected");
      audit(tenantId, instanceId, "驳回", instance);
      return toResponse(processInstanceMapper.findByTenantAndId(tenantId, instanceId));
    }

    approvalTaskApplicationService.completeTask(tenantId, task.id(), ApprovalStatus.APPROVED, request.comment());
    int next = instance.currentIndex() + 1;
    if (next < approvers.size()) {
      processInstanceMapper.updateProgress(tenantId, instanceId, next, "processing");
      approvalTaskApplicationService.createGenericPendingTask(tenantId, BIZ_TYPE, instanceId, null);
    } else {
      processInstanceMapper.updateProgress(tenantId, instanceId, instance.currentIndex(), "approved");
    }
    audit(tenantId, instanceId, "通过", instance);
    return toResponse(processInstanceMapper.findByTenantAndId(tenantId, instanceId));
  }

  private void audit(String tenantId, String instanceId, String action, ProcessInstance instance) {
    auditLogApplicationService.recordTenantAction(
        tenantId, "process_instance.reviewed", "process", instanceId,
        "流程「" + instance.processName() + "」节点" + action);
  }

  private Map<String, String> parseForm(String json) {
    try {
      return OBJECT_MAPPER.readValue(json == null || json.isBlank() ? "{}" : json, FORM_TYPE);
    } catch (Exception e) {
      return Map.of();
    }
  }

  private List<ResolvedStep> readPath(String json) {
    try {
      return OBJECT_MAPPER.readValue(json == null ? "[]" : json, new TypeReference<List<ResolvedStep>>() {});
    } catch (Exception e) {
      return List.of();
    }
  }

  private String writeJson(Object value) {
    try {
      return OBJECT_MAPPER.writeValueAsString(value);
    } catch (Exception e) {
      throw new IllegalStateException("Cannot serialize", e);
    }
  }

  private ProcessInstanceResponse toResponse(ProcessInstance i) {
    return new ProcessInstanceResponse(
        i.id(), i.processId(), i.processName(), i.amount(), i.status(),
        i.currentIndex(), i.resolvedPath(), i.formData(), i.initiatorId(), i.createdAt());
  }
}
