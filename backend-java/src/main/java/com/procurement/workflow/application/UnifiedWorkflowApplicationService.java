package com.procurement.workflow.application;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.attachment.domain.Attachment;
import com.procurement.attachment.infrastructure.AttachmentMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.application.DataScopeService;
import com.procurement.identity.application.PermissionService;
import com.procurement.identity.domain.BuyerUser;
import com.procurement.identity.domain.DataScope;
import com.procurement.identity.infrastructure.BuyerUserMapper;
import com.procurement.organization.domain.Department;
import com.procurement.organization.infrastructure.DepartmentMapper;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.notification.domain.NotificationTitle;
import com.procurement.workflow.api.CompleteWorkflowTaskRequest;
import com.procurement.workflow.api.UnifiedWorkflowTaskResponse;
import com.procurement.workflow.api.WorkflowInstanceHistoryResponse;
import com.procurement.workflow.api.WorkflowAttachmentResponse;
import com.procurement.workflow.api.WorkflowInstanceLedgerResponse;
import com.procurement.workflow.api.WorkflowPublishedFormResponse;
import com.procurement.workflow.api.WorkflowTaskEventResponse;
import com.procurement.workflow.definition.FlowableProcessCompiler;
import com.procurement.workflow.definition.WorkflowBusinessTypeCatalog;
import com.procurement.workflow.definition.WorkflowDefinitionSchema;
import com.procurement.workflow.definition.WorkflowExecutablePathResolver;
import com.procurement.workflow.definition.WorkflowSchemaValidator;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import com.procurement.workflow.domain.WorkflowDefinitionVersion;
import com.procurement.workflow.domain.WorkflowInstanceStatus;
import com.procurement.workflow.domain.WorkflowTaskEvent;
import com.procurement.workflow.infrastructure.WorkflowBusinessInstanceMapper;
import com.procurement.workflow.infrastructure.WorkflowTaskEventMapper;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.TaskService;
import org.flowable.engine.runtime.ProcessInstance;
import org.flowable.identitylink.api.IdentityLink;
import org.flowable.task.api.Task;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

// 唯一生产审批运行时。所有业务审批均以 Flowable 任务为准，业务库只保存关联、状态和审计快照。
@Service
public class UnifiedWorkflowApplicationService {
  private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

  private final WorkflowDefinitionPublicationService workflowDefinitionPublicationService;
  private final WorkflowBusinessInstanceMapper workflowBusinessInstanceMapper;
  private final WorkflowTaskEventMapper workflowTaskEventMapper;
  private final WorkflowSchemaValidator workflowSchemaValidator;
  private final ObjectMapper objectMapper;
  private final RuntimeService runtimeService;
  private final TaskService taskService;
  private final BuyerUserMapper buyerUserMapper;
  private final DepartmentMapper departmentMapper;
  private final PermissionService permissionService;
  private final DataScopeService dataScopeService;
  private final AuditLogApplicationService auditLogApplicationService;
  private final AttachmentMapper attachmentMapper;
  private final NotificationApplicationService notificationApplicationService;
  private final List<WorkflowBusinessCompletionHandler> completionHandlers;

  public UnifiedWorkflowApplicationService(
      WorkflowDefinitionPublicationService workflowDefinitionPublicationService,
      WorkflowBusinessInstanceMapper workflowBusinessInstanceMapper,
      WorkflowTaskEventMapper workflowTaskEventMapper,
      WorkflowSchemaValidator workflowSchemaValidator,
      ObjectMapper objectMapper,
      RuntimeService runtimeService,
      TaskService taskService,
      BuyerUserMapper buyerUserMapper,
      DepartmentMapper departmentMapper,
      PermissionService permissionService,
      DataScopeService dataScopeService,
      AuditLogApplicationService auditLogApplicationService,
      AttachmentMapper attachmentMapper,
      NotificationApplicationService notificationApplicationService,
      List<WorkflowBusinessCompletionHandler> completionHandlers) {
    this.workflowDefinitionPublicationService = workflowDefinitionPublicationService;
    this.workflowBusinessInstanceMapper = workflowBusinessInstanceMapper;
    this.workflowTaskEventMapper = workflowTaskEventMapper;
    this.workflowSchemaValidator = workflowSchemaValidator;
    this.objectMapper = objectMapper;
    this.runtimeService = runtimeService;
    this.taskService = taskService;
    this.buyerUserMapper = buyerUserMapper;
    this.departmentMapper = departmentMapper;
    this.permissionService = permissionService;
    this.dataScopeService = dataScopeService;
    this.auditLogApplicationService = auditLogApplicationService;
    this.attachmentMapper = attachmentMapper;
    this.notificationApplicationService = notificationApplicationService;
    this.completionHandlers = completionHandlers == null ? List.of() : List.copyOf(completionHandlers);
  }

  @Transactional
  public WorkflowStartResult start(WorkflowStartCommand command) {
    String tenantId = TenantAccessGuard.requireTenantId("unified workflow APIs");
    String actorId = TenantAccessGuard.requireUserId("unified workflow APIs");
    WorkflowBusinessTypeCatalog.requireSupported(command.businessType());
    requireCompletionHandler(command.businessType());
    if (command.businessId() == null || command.businessId().isBlank()) {
      throw new IllegalArgumentException("Workflow businessId is required");
    }
    WorkflowBusinessInstance existing = workflowBusinessInstanceMapper.findActiveByBusiness(
        tenantId, command.businessType(), command.businessId());
    if (existing != null) {
      throw new IllegalStateException("An active workflow already exists for this business object: " + command.businessId());
    }

    WorkflowDefinitionVersion version = workflowDefinitionPublicationService.requirePublishedVersion(
        tenantId, command.businessType(), actorId);
    WorkflowDefinitionSchema schema = workflowSchemaValidator.validate(
        tenantId, version.formSchema(), version.flowSchema());
    Map<String, Object> formData = workflowSchemaValidator.validateStartData(schema, command.formData());
    String workflowInstanceId = "workflow-" + UUID.randomUUID();
    String departmentId = resolveWorkflowDepartmentId(tenantId, actorId, command.departmentId());
    BigDecimal amount = command.amount() == null ? BigDecimal.ZERO : command.amount();
    Map<String, Object> variables = new HashMap<>();
    variables.put("tenantId", tenantId);
    variables.put("workflowInstanceId", workflowInstanceId);
    variables.put("businessType", command.businessType());
    variables.put("businessId", command.businessId());
    variables.put("initiatorId", actorId);
    variables.put("departmentId", departmentId);
    variables.put("amount", amount);
    formData.forEach((key, value) -> variables.put("form_" + key, value));
    bindDepartmentManagerAssignments(tenantId, departmentId, schema.steps(), variables);

    ProcessInstance flowableInstance = runtimeService.startProcessInstanceById(
        version.flowableProcessDefinitionId(), workflowInstanceId, variables);
    workflowBusinessInstanceMapper.insert(
        workflowInstanceId,
        tenantId,
        command.businessType(),
        command.businessId(),
        version.id(),
        flowableInstance.getId(),
        WorkflowInstanceStatus.PROCESSING,
        actorId,
        departmentId,
        amount,
        writeJson(formData),
        writeJson(command.businessSnapshot() == null ? Map.of() : command.businessSnapshot()));
    recordCreatedTasks(tenantId, workflowInstanceId, flowableInstance.getId());
    auditLogApplicationService.recordTenantAction(
        tenantId,
        "workflow.started",
        command.businessType(),
        command.businessId(),
        "已按发布版本 " + version.id() + " 发起 Flowable 审批");
    WorkflowBusinessInstance saved = workflowBusinessInstanceMapper.findByTenantAndId(tenantId, workflowInstanceId);
    Task firstTask = firstActiveTask(flowableInstance.getId());
    return new WorkflowStartResult(
        saved.id(),
        saved.flowableProcessInstanceId(),
        saved.definitionVersionId(),
        firstTask == null ? null : firstTask.getId(),
        saved.status(),
        saved.createdAt());
  }

  @Transactional
  public void withdrawPurchaseDemand(String workflowInstanceId, String reason) {
    String tenantId = TenantAccessGuard.requireTenantId("unified workflow APIs");
    String actorId = TenantAccessGuard.requireUserId("unified workflow APIs");
    permissionService.require("buyer:demand:create");
    if (reason == null || reason.isBlank() || reason.strip().length() > 1000) {
      throw new IllegalArgumentException("撤回原因必填且不得超过1000字");
    }
    // Complete locks this same row through its process-instance lookup before changing Flowable tasks.
    WorkflowBusinessInstance instance = workflowBusinessInstanceMapper.findByTenantAndIdForUpdate(tenantId, workflowInstanceId);
    if (instance == null || !"purchase_demand".equals(instance.businessType())) {
      throw new IllegalArgumentException("仅采购需求审批支持发起人撤回");
    }
    if (!actorId.equals(instance.initiatorId())) {
      throw new PermissionDeniedException("仅审批发起人可撤回本人的采购需求");
    }
    if (!WorkflowInstanceStatus.PROCESSING.equals(instance.status())) {
      throw new IllegalStateException("仅审批中的采购需求可撤回");
    }
    if (!isVisible(instance, dataScopeService.currentUserDataScope())) {
      throw new PermissionDeniedException("当前数据范围无权撤回该采购需求");
    }
    String comment = reason.strip();
    runtimeService.deleteProcessInstance(instance.flowableProcessInstanceId(), comment);
    if (workflowBusinessInstanceMapper.complete(tenantId, instance.id(), WorkflowInstanceStatus.CANCELLED, actorId) == 0) {
      throw new IllegalStateException("审批实例状态已变化,无法撤回");
    }
    workflowTaskEventMapper.insert("workflow-task-event-" + UUID.randomUUID(), tenantId, instance.id(),
        null, null, null, "cancelled", actorId, comment);
    requireCompletionHandler(instance.businessType()).onCancelled(instance, actorId, comment);
    auditLogApplicationService.recordTenantAction(tenantId, "workflow.cancelled", "purchase_demand", instance.businessId(), comment);
  }

  @Transactional
  public void withdrawCurrentPurchaseDemand(String demand,String reason){String tenant=TenantAccessGuard.requireTenantId("demand workflow withdrawal");var active=workflowBusinessInstanceMapper.findActiveByBusiness(tenant,"purchase_demand",demand);if(active==null)throw new IllegalStateException("在审需求缺少真实流程，不能绕过审批");withdrawPurchaseDemand(active.id(),reason);}

  @Transactional
  public void withdrawBudgetRequest(String workflowInstanceId,String reason) {
    String tenant=TenantAccessGuard.requireTenantId("budget withdrawal");
    String actor=TenantAccessGuard.requireUserId("budget withdrawal");
    permissionService.require("buyer:budget:manage");
    if(reason==null || reason.isBlank() || reason.length()>1000) throw new IllegalArgumentException("撤回原因必填且不得超过1000字");
    var instance=workflowBusinessInstanceMapper.findByTenantAndIdForUpdate(tenant,workflowInstanceId);
    if(instance==null || !java.util.Set.of("budget_change","budget_exception").contains(instance.businessType())) throw new IllegalArgumentException("预算审批实例不存在");
    if(!actor.equals(instance.initiatorId()) || !isVisible(instance,dataScopeService.currentUserDataScope())) throw new PermissionDeniedException("仅有权查看的发起人可撤回本人预算申请");
    if(!WorkflowInstanceStatus.PROCESSING.equals(instance.status())) throw new IllegalStateException("只能撤回审批中的预算申请");
    runtimeService.deleteProcessInstance(instance.flowableProcessInstanceId(),reason.strip());
    if(workflowBusinessInstanceMapper.complete(tenant,instance.id(),WorkflowInstanceStatus.CANCELLED,actor)!=1) throw new IllegalStateException("审批状态已变化");
    workflowTaskEventMapper.insert("workflow-task-event-"+UUID.randomUUID(),tenant,instance.id(),null,null,null,"cancelled",actor,reason.strip());
    requireCompletionHandler(instance.businessType()).onCancelled(instance,actor,reason.strip());
    auditLogApplicationService.recordTenantAction(tenant,"workflow.cancelled",instance.businessType(),instance.businessId(),reason.strip());
  }

  @Transactional
  public void cancelQualificationReview(String id,String reason) {
    String tenant=TenantAccessGuard.requireTenantId("qualification cancellation"),actor=TenantAccessGuard.requireUserId("qualification cancellation");
    permissionService.require("buyer:supplier:manage");
    if(reason==null||reason.isBlank()||reason.length()>1000)throw new IllegalArgumentException("取消原因必填且不超过1000字");
    var instance=workflowBusinessInstanceMapper.findByTenantAndIdForUpdate(tenant,id);
    if(instance==null||!"supplier_qualification_change".equals(instance.businessType()))throw new IllegalArgumentException("资质审批不存在");
    if(!actor.equals(instance.initiatorId()))permissionService.require("buyer:workflow:manage");
    if(!isVisible(instance,dataScopeService.currentUserDataScope()))throw new PermissionDeniedException("当前数据范围无权取消此流程");
    if(!WorkflowInstanceStatus.PROCESSING.equals(instance.status()))throw new IllegalStateException("审批已结束");
    runtimeService.deleteProcessInstance(instance.flowableProcessInstanceId(),reason.strip());
    if(workflowBusinessInstanceMapper.complete(tenant,id,WorkflowInstanceStatus.CANCELLED,actor)!=1)throw new IllegalStateException("审批状态已变化");
    workflowTaskEventMapper.insert("workflow-task-event-"+UUID.randomUUID(),tenant,id,null,null,null,"cancelled",actor,reason.strip());
    requireCompletionHandler(instance.businessType()).onCancelled(instance,actor,reason.strip());
    auditLogApplicationService.recordTenantAction(tenant,"workflow.cancelled",instance.businessType(),instance.businessId(),reason.strip());
  }

  @Transactional
  public void withdrawProcurementProject(String id,String reason) {
    String tenant=TenantAccessGuard.requireTenantId("project withdrawal"),actor=TenantAccessGuard.requireUserId("project withdrawal");
    permissionService.require("buyer:project:manage");
    if(reason==null||reason.isBlank()||reason.length()>1000)throw new IllegalArgumentException("撤回原因必填且不超过1000字");
    var instance=workflowBusinessInstanceMapper.findByTenantAndIdForUpdate(tenant,id);
    if(instance==null||!List.of("project_initiation","project_change","project_carryover","project_liquidation","project_reopen").contains(instance.businessType()))throw new IllegalArgumentException("项目审批不存在");
    if(!actor.equals(instance.initiatorId())||!isVisible(instance,dataScopeService.currentUserDataScope()))throw new PermissionDeniedException("只有当前数据范围内的发起人可撤回");
    if(!WorkflowInstanceStatus.PROCESSING.equals(instance.status()))throw new IllegalStateException("审批已经结束");
    runtimeService.deleteProcessInstance(instance.flowableProcessInstanceId(),reason.strip());
    if(workflowBusinessInstanceMapper.complete(tenant,id,WorkflowInstanceStatus.CANCELLED,actor)!=1)throw new IllegalStateException("流程已变化");
    workflowTaskEventMapper.insert("workflow-task-event-"+UUID.randomUUID(),tenant,id,null,null,null,"cancelled",actor,reason.strip());
    requireCompletionHandler(instance.businessType()).onCancelled(instance,actor,reason.strip());
    auditLogApplicationService.recordTenantAction(tenant,"workflow.cancelled","project_change".equals(instance.businessType())?"procurement_project_change":"procurement_project",instance.businessId(),reason.strip());
  }

  @Transactional
  public void withdrawFrozenPaymentCorrection(String id,String reason) {
    String tenant=TenantAccessGuard.requireTenantId("frozen correction withdrawal"),actor=TenantAccessGuard.requireUserId("frozen correction withdrawal");
    permissionService.require("buyer:payment:reverse");
    if(reason==null||reason.isBlank()||reason.length()>1000)throw new IllegalArgumentException("撤回原因必填且不超过1000字");
    var instance=workflowBusinessInstanceMapper.findByTenantAndIdForUpdate(tenant,id);
    if(instance==null||!"frozen_payment_correction".equals(instance.businessType()))throw new IllegalArgumentException("更正审批不存在");
    if(!actor.equals(instance.initiatorId())||!isVisible(instance,dataScopeService.currentUserDataScope()))throw new PermissionDeniedException("只有当前数据范围内的发起人可撤回");
    if(!WorkflowInstanceStatus.PROCESSING.equals(instance.status()))throw new IllegalStateException("审批已经结束");
    runtimeService.deleteProcessInstance(instance.flowableProcessInstanceId(),reason.strip());
    if(workflowBusinessInstanceMapper.complete(tenant,id,WorkflowInstanceStatus.CANCELLED,actor)!=1)throw new IllegalStateException("流程已变化");
    workflowTaskEventMapper.insert("workflow-task-event-"+UUID.randomUUID(),tenant,id,null,null,null,"cancelled",actor,reason.strip());
    requireCompletionHandler(instance.businessType()).onCancelled(instance,actor,reason.strip());
    auditLogApplicationService.recordTenantAction(tenant,"workflow.cancelled","frozen_payment_correction",instance.businessId(),reason.strip());
  }

  @Transactional
  public void withdrawFundingChange(String id,String reason) {
    String tenant=TenantAccessGuard.requireTenantId("funding withdrawal"),actor=TenantAccessGuard.requireUserId("funding withdrawal");
    permissionService.require("buyer:budget:manage");
    if(reason==null||reason.isBlank()||reason.length()>1000)throw new IllegalArgumentException("撤回原因必填且不超过1000字");
    var instance=workflowBusinessInstanceMapper.findByTenantAndIdForUpdate(tenant,id);
    if(instance==null||!"funding_change".equals(instance.businessType()))throw new IllegalArgumentException("资金审批不存在");
    if(!actor.equals(instance.initiatorId())||!isVisible(instance,dataScopeService.currentUserDataScope()))throw new PermissionDeniedException("只有当前数据范围内的发起人可撤回");
    if(!WorkflowInstanceStatus.PROCESSING.equals(instance.status()))throw new IllegalStateException("审批已经结束");
    runtimeService.deleteProcessInstance(instance.flowableProcessInstanceId(),reason.strip());
    if(workflowBusinessInstanceMapper.complete(tenant,id,WorkflowInstanceStatus.CANCELLED,actor)!=1)throw new IllegalStateException("流程已变化");
    workflowTaskEventMapper.insert("workflow-task-event-"+UUID.randomUUID(),tenant,id,null,null,null,"cancelled",actor,reason.strip());
    requireCompletionHandler(instance.businessType()).onCancelled(instance,actor,reason.strip());
    auditLogApplicationService.recordTenantAction(tenant,"workflow.cancelled","funding_change",instance.businessId(),reason.strip());
  }

  @Transactional
  public void withdrawLudongApplication(String workflowInstanceId, String reason) {
    String tenant = TenantAccessGuard.requireTenantId("school application withdrawal");
    String actor = TenantAccessGuard.requireUserId("school application withdrawal");
    permissionService.require("buyer:ludong-poc:write");
    if (reason == null || reason.isBlank() || reason.length() > 1000) throw new IllegalArgumentException("撤回原因必填且不得超过1000字");
    var instance = workflowBusinessInstanceMapper.findByTenantAndIdForUpdate(tenant, workflowInstanceId);
    if (instance == null || !"ludong_project_application".equals(instance.businessType())) throw new IllegalArgumentException("采购申报审批不存在");
    if (!actor.equals(instance.initiatorId()) || !isVisible(instance, dataScopeService.currentUserDataScope())) {
      throw new PermissionDeniedException("只有原发起人可撤回本人申报审批");
    }
    if (!WorkflowInstanceStatus.PROCESSING.equals(instance.status())) throw new IllegalStateException("只能撤回在审申报");
    runtimeService.deleteProcessInstance(instance.flowableProcessInstanceId(), reason.strip());
    if (workflowBusinessInstanceMapper.complete(tenant, instance.id(), WorkflowInstanceStatus.CANCELLED, actor) != 1) {
      throw new IllegalStateException("审批实例已变化，请刷新");
    }
    workflowTaskEventMapper.insert("workflow-event-" + UUID.randomUUID(), tenant, instance.id(), null, null, null, "cancelled", actor, reason.strip());
    requireCompletionHandler(instance.businessType()).onCancelled(instance, actor, reason.strip());
    auditLogApplicationService.recordTenantAction(tenant, "workflow.cancelled", instance.businessType(), instance.businessId(), reason.strip());
  }

  public List<UnifiedWorkflowTaskResponse> listCurrentUserTasks() {
    String tenantId = TenantAccessGuard.requireTenantId("unified workflow APIs");
    String userId = TenantAccessGuard.requireUserId("unified workflow APIs");
    permissionService.require("buyer:workflow:review");
    DataScope dataScope = dataScopeService.currentUserDataScope();
    if (dataScope.blocksAll()) {
      return List.of();
    }
    List<String> roleGroups = buyerUserMapper.listBuyerRoleIdsByTenantAndUser(tenantId, userId).stream()
        .map(roleId -> FlowableProcessCompiler.roleGroup(tenantId, roleId))
        .toList();
    List<UnifiedWorkflowTaskResponse> tasks = new ArrayList<>();
    for (Task task : taskService.createTaskQuery()
        .processVariableValueEquals("tenantId", tenantId)
        .active()
        .orderByTaskCreateTime().desc()
        .list()) {
      WorkflowBusinessInstance instance = workflowBusinessInstanceMapper
          .findByTenantAndFlowableProcessInstanceId(tenantId, task.getProcessInstanceId());
      if (instance == null || !isVisible(instance, dataScope) || !canHandle(task, userId, roleGroups)) {
        continue;
      }
      if (initiatorHandlingBlocked(instance,userId)) continue;
      tasks.add(toTaskResponse(task, instance));
    }
    return tasks;
  }

  /** 返回当前用户确实有权办理的活动任务，供业务门面绑定节点表单并阻止伪造 nodeId。 */
  public UnifiedWorkflowTaskResponse requireCurrentUserTask(String taskId) {
    return listCurrentUserTasks().stream()
        .filter(task -> task.taskId().equals(taskId))
        .findFirst()
        .orElseThrow(() -> new PermissionDeniedException("当前用户无权办理该审批任务"));
  }

  public WorkflowTaskContext requireCurrentUserTaskContext(String taskId) {
    UnifiedWorkflowTaskResponse task = requireCurrentUserTask(taskId);
    return new WorkflowTaskContext(
        task.taskId(), task.businessType(), task.businessId(), task.taskDefinitionKey());
  }

  @Transactional
  public WorkflowCompletionResult completeCurrentUserTaskForBusiness(
      String taskId, String action, String comment) {
    TaskCompletionOutcome outcome = completeCurrentUserTaskInternal(
        taskId, new CompleteWorkflowTaskRequest(action, comment), true);
    WorkflowInstanceHistoryResponse history = outcome.history();
    OffsetDateTime actedAt = history.events().isEmpty()
        ? history.createdAt()
        : history.events().getLast().createdAt();
    return new WorkflowCompletionResult(history.status(), actedAt, outcome.reusedTasks());
  }

  public List<WorkflowApprovalSignature> listApprovalSignatures(
      String businessType, String businessId) {
    WorkflowInstanceHistoryResponse history = getCurrentTenantBusinessHistory(businessType, businessId);
    if (history == null) {
      return List.of();
    }
    return history.events().stream()
        .filter(event -> event.effective() && "approved".equals(event.action()) && event.actorId() != null)
        .map(event -> new WorkflowApprovalSignature(
            event.nodeId(), event.actorName() == null ? event.actorId() : event.actorName(), event.createdAt()))
        .toList();
  }

  @Transactional
  public WorkflowInstanceHistoryResponse completeCurrentUserTask(
      String taskId, CompleteWorkflowTaskRequest request) {
    return completeCurrentUserTaskInternal(taskId, request, false).history();
  }

  private TaskCompletionOutcome completeCurrentUserTaskInternal(
      String taskId, CompleteWorkflowTaskRequest request, boolean businessProjectionEnabled) {
    String tenantId = TenantAccessGuard.requireTenantId("unified workflow APIs");
    String userId = TenantAccessGuard.requireUserId("unified workflow APIs");
    permissionService.require("buyer:workflow:review");
    boolean approved = decision(request.action());
    Task task = taskService.createTaskQuery().taskId(taskId).active().singleResult();
    if (task == null) {
      throw new IllegalArgumentException("Workflow task not found or already completed: " + taskId);
    }
    WorkflowBusinessInstance instance = workflowBusinessInstanceMapper
        .findByTenantAndFlowableProcessInstanceId(tenantId, task.getProcessInstanceId());
    if (instance == null || !WorkflowInstanceStatus.PROCESSING.equals(instance.status())) {
      throw new IllegalArgumentException("Workflow task is not part of an active tenant workflow: " + taskId);
    }
    WorkflowBusinessCompletionHandler businessHandler = requireCompletionHandler(instance.businessType());
    if(businessHandler.requiresIndependentApprover() && userId.equals(instance.initiatorId())) {
      throw new PermissionDeniedException("预算申请与审批须职责分离，请由其他有权审批人办理");
    }
    if (businessHandler.requiresBusinessProjection() && !businessProjectionEnabled) {
      throw new IllegalStateException("该流程任务必须通过业务审批入口办理，以同步保存节点表单");
    }
    if (!isVisible(instance, dataScopeService.currentUserDataScope())) {
      throw new PermissionDeniedException("当前数据范围无权办理该审批任务");
    }
    List<String> roleGroups = buyerUserMapper.listBuyerRoleIdsByTenantAndUser(tenantId, userId).stream()
        .map(roleId -> FlowableProcessCompiler.roleGroup(tenantId, roleId))
        .toList();
    if (!canHandle(task, userId, roleGroups)) {
      throw new PermissionDeniedException("当前用户不是该审批任务的办理人或候选人");
    }
    if (org.flowable.task.api.DelegationState.PENDING.equals(task.getDelegationState())) {
      throw new IllegalStateException("该任务正在加审，请使用加审意见入口，不得代替原节点审批");
    }
    if (approved && Boolean.TRUE.equals(taskService.getVariableLocal(taskId, "additionalReviewRejected"))) {
      throw new IllegalStateException("加审意见为不同意，只能退回或驳回，不可直接通过");
    }
    businessHandler.validateTask(instance, approved);
    if (task.getAssignee() == null || task.getAssignee().isBlank()) {
      taskService.claim(taskId, userId);
      recordTaskEvent(tenantId, instance.id(), task, "claimed", userId, null);
    }
    taskService.complete(taskId, Map.of(
        "approved", approved,
        "reviewComment", request.comment() == null ? "" : request.comment()));
    recordTaskEvent(tenantId, instance.id(), task, approved ? "approved" : "rejected", userId, request.comment());
    List<WorkflowReusedTask> reusedTasks = approved
        && businessHandler.reusesEmployeeDecisions()
        ? reuseApprovedDecisionsWithinInstance(tenantId, instance)
        : List.of();
    boolean ended = runtimeService.createProcessInstanceQuery()
        .processInstanceId(instance.flowableProcessInstanceId())
        .singleResult() == null;
    if (ended) {
      String nextStatus = approved ? WorkflowInstanceStatus.APPROVED : WorkflowInstanceStatus.REJECTED;
      String completionActorId = reusedTasks.isEmpty() ? userId : reusedTasks.getLast().actorId();
      String completionComment = reusedTasks.isEmpty() ? request.comment() : reusedTasks.getLast().comment();
      int changed = workflowBusinessInstanceMapper.complete(
          tenantId, instance.id(), nextStatus, completionActorId);
      if (changed == 0) {
        throw new IllegalStateException("Workflow instance changed before completion could be recorded: " + instance.id());
      }
      WorkflowBusinessInstance completed = workflowBusinessInstanceMapper.findByTenantAndId(tenantId, instance.id());
      requireCompletionHandler(completed.businessType()).onCompleted(
          completed, new WorkflowCompletion(approved, completionActorId, completionComment));
      if (reusedTasks.isEmpty()) {
        auditLogApplicationService.recordTenantAction(
            tenantId,
            approved ? "workflow.approved" : "workflow.rejected",
            completed.businessType(),
            completed.businessId(),
            "Flowable 审批流程已" + (approved ? "通过" : "驳回"));
      } else {
        auditLogApplicationService.recordAutomatedTenantAction(
            tenantId,
            completionActorId,
            "workflow.approved",
            completed.businessType(),
            completed.businessId(),
            "Flowable 审批流程已通过，最终节点按工号自动复用");
      }
    } else {
      recordCreatedTasks(tenantId, instance.id(), instance.flowableProcessInstanceId());
    }
    return new TaskCompletionOutcome(
        toHistoryResponse(
            tenantId, workflowBusinessInstanceMapper.findByTenantAndId(tenantId, instance.id())),
        reusedTasks);
  }

  // 兼容业务详情页的“通过/驳回”入口：仍按当前登录人的候选资格办理 Flowable 任务，不再写旧审批任务表。
  @Transactional
  public WorkflowCompletionResult completeCurrentUserBusinessTask(
      String businessType,
      String businessId,
      boolean approved,
      String comment) {
    UnifiedWorkflowTaskResponse task = listCurrentUserTasks().stream()
        .filter(item -> businessType.equals(item.businessType()) && businessId.equals(item.businessId()))
        .findFirst()
        .orElseThrow(() -> new IllegalStateException(
            "No actionable Flowable task found for business object: " + businessId));
    TaskCompletionOutcome outcome = completeCurrentUserTaskInternal(
        task.taskId(), new CompleteWorkflowTaskRequest(approved ? "approve" : "reject", comment), false);
    WorkflowInstanceHistoryResponse history = outcome.history();
    OffsetDateTime actedAt = history.events().isEmpty()
        ? history.createdAt()
        : history.events().getLast().createdAt();
    return new WorkflowCompletionResult(history.status(), actedAt, outcome.reusedTasks());
  }

  public void requireCurrentTenantInstanceReadAccess(String workflowInstanceId) {
    String tenantId = TenantAccessGuard.requireTenantId("unified workflow read authorization");
    permissionService.require("buyer:workflow:read");
    requireVisibleInstance(tenantId, workflowInstanceId);
  }

  public WorkflowInstanceHistoryResponse getCurrentTenantHistory(String workflowInstanceId) {
    String tenantId = TenantAccessGuard.requireTenantId("unified workflow APIs");
    permissionService.require("buyer:workflow:read");
    WorkflowBusinessInstance instance = requireVisibleInstance(tenantId, workflowInstanceId);
    return toHistoryResponse(tenantId, instance);
  }

  public void requireCurrentTenantBusinessInstanceReadAccess(String instanceId,String businessType,String businessId) {
    var history=getCurrentTenantHistory(instanceId);
    if(!businessType.equals(history.businessType())||!businessId.equals(history.businessId()))throw new IllegalArgumentException("审批实例与业务不匹配");
  }

  public com.procurement.workflow.api.WorkflowBusinessInstancePage listCurrentTenantBusinessInstances(
      String businessType, String businessId, int page, int pageSize) {
    String tenantId = TenantAccessGuard.requireTenantId("business workflow history");
    TenantAccessGuard.requireUserId("business workflow history");
    permissionService.require("buyer:workflow:read");
    WorkflowBusinessTypeCatalog.requireSupported(businessType);
    if (businessId == null || businessId.isBlank() || page < 1 || pageSize < 1 || pageSize > 100) {
      throw new IllegalArgumentException("审批历史分页参数无效");
    }
    var source = workflowBusinessInstanceMapper.listByBusiness(tenantId, businessType, businessId, 5001);
    if (source.size() > 5000) throw new IllegalArgumentException("单个业务审批历史超过5000条，未返回截断结果");
    var scope = dataScopeService.currentUserDataScope();
    var visible = source.stream().filter(instance -> isVisible(instance, scope)).toList();
    var items = visible.stream().skip((long) (page - 1) * pageSize).limit(pageSize)
        .map(instance -> toLedgerResponse(tenantId, instance)).toList();
    return new com.procurement.workflow.api.WorkflowBusinessInstancePage(items, visible.size(), page, pageSize);
  }

  @Transactional(readOnly = true, isolation = org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
  public List<WorkflowAuditEntry> businessAuditEntries(String businessType, String businessId) {
    var result = new ArrayList<WorkflowAuditEntry>();
    var first = listCurrentTenantBusinessInstances(businessType, businessId, 1, 100);
    for (int page = 1; page <= Math.max(1, (first.total() + 99) / 100); page++) {
      var batch = page == 1 ? first : listCurrentTenantBusinessInstances(businessType, businessId, page, 100);
      if (batch.total() != first.total()) throw new IllegalStateException("审批历史已变化，请重试");
      for (var item : batch.items()) {
        var history = getCurrentTenantHistory(item.workflowInstanceId());
        var events = history.events();
        if (events.isEmpty()) result.add(new WorkflowAuditEntry(history.workflowInstanceId(), history.definitionVersionId(), history.status(),
            history.initiatorName() == null ? history.initiatorId() : history.initiatorName(), history.createdAt(),
            history.completedByName() == null ? history.completedBy() : history.completedByName(), history.completedAt(), null, null, null, null, null));
        for (var event : events) {
          if (result.size() >= 5000) throw new IllegalArgumentException("审批历史导出超过5000行，未生成截断文件");
          result.add(new WorkflowAuditEntry(history.workflowInstanceId(), history.definitionVersionId(), history.status(),
            history.initiatorName() == null ? history.initiatorId() : history.initiatorName(), history.createdAt(),
            history.completedByName() == null ? history.completedBy() : history.completedByName(), history.completedAt(), event.nodeName(), event.action(),
            event.actorName() == null ? event.actorId() : event.actorName(), event.createdAt(), event.comment()));
        }
        if (result.size() > 5000) throw new IllegalArgumentException("审批历史导出超过5000行，未生成截断文件");
      }
    }
    return List.copyOf(result);
  }

  public WorkflowInstanceHistoryResponse getCurrentTenantBusinessHistory(
      String businessType, String businessId) {
    String tenantId = TenantAccessGuard.requireTenantId("unified workflow APIs");
    WorkflowBusinessTypeCatalog.requireSupported(businessType);
    requireWorkflowReadAccess();
    WorkflowBusinessInstance instance = workflowBusinessInstanceMapper.findLatestByBusiness(
        tenantId, businessType, businessId);
    if (instance == null) {
      String referenceField = switch (businessType) {
        case "rfq_award" -> "rfqId";
        case "payment_request" -> "invoiceId";
        case "payment_archive_exception" -> "paymentBatchNo";
        default -> null;
      };
      if (referenceField != null) {
        instance = workflowBusinessInstanceMapper.findLatestByBusinessReference(
            tenantId, businessType, referenceField, businessId);
      }
    }
    if (instance == null) {
      return null;
    }
    if (!isVisible(instance, dataScopeService.currentUserDataScope())) {
      throw new PermissionDeniedException("当前数据范围无权查看该审批实例");
    }
    return toHistoryResponse(tenantId, instance);
  }

  /** Complete, untruncated history for an already-authorized procurement graph. Never hides inaccessible instances. */
  public List<ProcurementExecutionHistory> procurementExecutionHistory(List<String> businessIds) {
    String tenantId = TenantAccessGuard.requireTenantId("procurement execution history");
    permissionService.require("buyer:workflow:read");
    var ids = new java.util.HashSet<>(businessIds);
    var scope = dataScopeService.currentUserDataScope();
    List<ProcurementExecutionHistory> result = new ArrayList<>();
    for (var instance : workflowBusinessInstanceMapper.listByTenant(tenantId, Integer.MAX_VALUE)) {
      boolean related = ids.contains(instance.businessId());
      if (!related && java.util.Set.of("rfq_award", "payment_request", "payment_archive_exception", "payment_batch")
          .contains(instance.businessType())) {
        try {
          var snapshot = objectMapper.readTree(instance.businessSnapshot());
          related = snapshot != null && (ids.contains(snapshot.path("rfqId").asText())
              || ids.contains(snapshot.path("invoiceId").asText())
              || ids.contains(snapshot.path("paymentBatchNo").asText()));
        } catch (Exception error) {
          throw new IllegalStateException("Cannot verify procurement workflow business reference", error);
        }
      }
      if (!related) continue;
      if (!isVisible(instance, scope)) throw new PermissionDeniedException("采购档案包含当前范围不可见的审批实例");
      var events = new ArrayList<>(workflowTaskEventMapper.listByTenantAndWorkflowInstance(tenantId, instance.id()));
      events.sort(java.util.Comparator.comparing(WorkflowTaskEvent::createdAt).thenComparing(WorkflowTaskEvent::id));
      result.add(new ProcurementExecutionHistory(instance, List.copyOf(events)));
    }
    result.sort(java.util.Comparator.comparing(history -> history.instance().id()));
    return List.copyOf(result);
  }

  public record ProcurementExecutionHistory(WorkflowBusinessInstance instance, List<WorkflowTaskEvent> events) {}

  public WorkflowBusinessSummary getCurrentTenantBusinessSummary(String businessType, String businessId) {
    var history = getCurrentTenantBusinessHistory(businessType, businessId);
    return history == null ? null : new WorkflowBusinessSummary(
        history.workflowInstanceId(), history.status(), history.initiatorName(), history.createdAt(),
        history.completedByName(), history.completedAt());
  }

  // Task authorization uses the existing row-locking lookup; keep this transaction writable.
  @Transactional(isolation = org.springframework.transaction.annotation.Isolation.REPEATABLE_READ)
  public com.procurement.workflow.api.WorkflowBusinessInstancePage pageCurrentTenantInstances(
      String view, int page, int pageSize, String keyword) {
    if (page < 1 || pageSize < 1 || pageSize > 100) {
      throw new IllegalArgumentException("page must be positive and pageSize must be between 1 and 100");
    }
    String search = keyword == null ? "" : keyword.trim();
    if (search.length() > 100) throw new IllegalArgumentException("keyword must not exceed 100 characters");
    String tenantId = TenantAccessGuard.requireTenantId("unified workflow APIs");
    String userId = TenantAccessGuard.requireUserId("unified workflow APIs");
    String selectedView = view == null ? "pending" : view;
    long offset = (long) (page - 1) * pageSize;
    if ("pending".equals(selectedView)) {
      var authorized = new LinkedHashMap<String, WorkflowInstanceLedgerResponse>();
      for (var task : listCurrentUserTasks()) {
        if (authorized.containsKey(task.workflowInstanceId())) continue;
        var instance = workflowBusinessInstanceMapper.findByTenantAndId(tenantId, task.workflowInstanceId());
        if (instance == null) continue;
        var item = toLedgerResponse(tenantId, instance, task);
        String value = search.toLowerCase(java.util.Locale.ROOT);
        if (value.isEmpty() || java.util.stream.Stream.of(item.businessId(), item.workflowInstanceId(), item.initiatorName())
            .filter(Objects::nonNull).anyMatch(field -> field.toLowerCase(java.util.Locale.ROOT).contains(value))) {
          authorized.put(instance.id(), item);
        }
      }
      var sorted = authorized.values().stream().sorted(java.util.Comparator
          .comparing(WorkflowInstanceLedgerResponse::updatedAt, java.util.Comparator.nullsLast(java.util.Comparator.reverseOrder()))
          .thenComparing(WorkflowInstanceLedgerResponse::workflowInstanceId, java.util.Comparator.reverseOrder())).toList();
      return new com.procurement.workflow.api.WorkflowBusinessInstancePage(
          sorted.stream().skip(offset).limit(pageSize).toList(), sorted.size(), page, pageSize);
    }
    switch (selectedView) {
      case "processed" -> permissionService.require("buyer:workflow:review");
      case "initiated" -> requireWorkflowReadAccess();
      case "all" -> permissionService.require("buyer:workflow:read");
      default -> throw new IllegalArgumentException("Unsupported workflow ledger view: " + selectedView);
    }
    var scope = dataScopeService.currentUserDataScope();
    var query = new com.procurement.workflow.domain.WorkflowLedgerQuery(tenantId, selectedView, userId,
        scope.restricted(), scope.departmentIds(), scope.requesterId(), search);
    long total = workflowBusinessInstanceMapper.countLedger(query);
    var items = offset >= total ? List.<WorkflowInstanceLedgerResponse>of()
        : workflowBusinessInstanceMapper.pageLedger(query, pageSize, offset).stream()
            .map(instance -> toLedgerResponse(tenantId, instance)).toList();
    return new com.procurement.workflow.api.WorkflowBusinessInstancePage(items, total, page, pageSize);
  }

  public List<WorkflowInstanceLedgerResponse> listCurrentTenantInstances(String view, int requestedLimit) {
    String tenantId = TenantAccessGuard.requireTenantId("unified workflow APIs");
    String userId = TenantAccessGuard.requireUserId("unified workflow APIs");
    int limit = Math.max(1, Math.min(requestedLimit, 200));
    DataScope dataScope = dataScopeService.currentUserDataScope();
    List<WorkflowBusinessInstance> instances;
    switch (view == null ? "pending" : view) {
      case "pending" -> {
        return listCurrentUserTasks().stream()
            .map(task -> workflowBusinessInstanceMapper.findByTenantAndId(tenantId, task.workflowInstanceId()))
            .filter(Objects::nonNull)
            .map(instance -> toLedgerResponse(tenantId, instance))
            .limit(limit)
            .toList();
      }
      case "processed" -> {
        permissionService.require("buyer:workflow:review");
        instances = workflowBusinessInstanceMapper.listActedByTenantUser(tenantId, userId, limit);
      }
      case "initiated" -> {
        requireWorkflowReadAccess();
        instances = workflowBusinessInstanceMapper.listByTenantAndInitiator(tenantId, userId, limit);
      }
      case "all" -> {
        permissionService.require("buyer:workflow:read");
        instances = workflowBusinessInstanceMapper.listByTenant(tenantId, limit);
      }
      default -> throw new IllegalArgumentException("Unsupported workflow ledger view: " + view);
    }
    return instances.stream()
        .filter(instance -> isVisible(instance, dataScope))
        .map(instance -> toLedgerResponse(tenantId, instance))
        .toList();
  }

  public WorkflowPublishedFormResponse getPublishedForm(String businessType) {
    String tenantId = TenantAccessGuard.requireTenantId("unified workflow APIs");
    WorkflowBusinessTypeCatalog.requireSupported(businessType);
    WorkflowDefinitionVersion version = workflowDefinitionPublicationService.findPublishedVersion(tenantId, businessType);
    if (version == null) {
      return new WorkflowPublishedFormResponse(businessType, null, "{\"fields\":[]}", null);
    }
    return new WorkflowPublishedFormResponse(
        businessType, version.id(), version.formSchema(), version.publishedAt());
  }

  private WorkflowBusinessCompletionHandler requireCompletionHandler(String businessType) {
    return completionHandlers.stream()
        .filter(handler -> Objects.equals(handler.businessType(), businessType))
        .findFirst()
        .orElseThrow(() -> new IllegalStateException(
            "No workflow business callback is registered for: " + businessType));
  }

  private WorkflowBusinessInstance requireVisibleInstance(String tenantId, String workflowInstanceId) {
    WorkflowBusinessInstance instance = workflowBusinessInstanceMapper.findByTenantAndId(tenantId, workflowInstanceId);
    if (instance == null) {
      throw new IllegalArgumentException("Workflow instance not found in tenant scope: " + workflowInstanceId);
    }
    if (!isVisible(instance, dataScopeService.currentUserDataScope())) {
      throw new PermissionDeniedException("当前数据范围无权查看该审批实例");
    }
    return instance;
  }

  private void requireWorkflowReadAccess() {
    if (!permissionService.currentUserHas("buyer:workflow:read")
        && !permissionService.currentUserHas("buyer:workflow:review")
        && !permissionService.currentUserHas("buyer:workflow:manage")) {
      permissionService.require("buyer:workflow:read");
    }
  }

  private boolean initiatorHandlingBlocked(WorkflowBusinessInstance instance,String userId) {
    return userId.equals(instance.initiatorId()) && completionHandlers.stream()
        .filter(handler -> handler.businessType().equals(instance.businessType()))
        .anyMatch(WorkflowBusinessCompletionHandler::requiresIndependentApprover);
  }

  public boolean initiatorRequiresIndependentApprover(String businessType) {
    return completionHandlers.stream().filter(handler -> handler.businessType().equals(businessType))
        .anyMatch(WorkflowBusinessCompletionHandler::requiresIndependentApprover);
  }

  public boolean supportsTaskRework(String businessType) {
    return requireCompletionHandler(businessType).supportsTaskRework();
  }

  private boolean canHandle(Task task, String userId, List<String> roleGroups) {
    if (task.getAssignee() != null && !task.getAssignee().isBlank()) {
      return userId.equals(task.getAssignee());
    }
    for (IdentityLink link : taskService.getIdentityLinksForTask(task.getId())) {
      if (!"candidate".equals(link.getType())) {
        continue;
      }
      if (userId.equals(link.getUserId()) || roleGroups.contains(link.getGroupId())) {
        return true;
      }
    }
    return false;
  }

  // 鲁东材料包中同一人员可能同时承担多个审核角色。每产生一个新任务，
  // 都在整个流程实例已通过历史中按工号查重，因此支持 A-B-A 这类非连续复用。
  private List<WorkflowReusedTask> reuseApprovedDecisionsWithinInstance(
      String tenantId, WorkflowBusinessInstance instance) {
    List<WorkflowReusedTask> reusedTasks = new ArrayList<>();
    while (runtimeService.createProcessInstanceQuery()
        .processInstanceId(instance.flowableProcessInstanceId()).singleResult() != null) {
      Task next = firstActiveTask(instance.flowableProcessInstanceId());
      if (next == null) {
        return List.copyOf(reusedTasks);
      }
      SoleApprovalHandler handler = soleApprovalHandler(next, tenantId);
      WorkflowTaskEvent source = handler == null
          ? null
          : findApprovedEventByEmployeeNo(tenantId, instance.id(), handler.employeeNo());
      if (source == null) {
        recordCreatedTasks(tenantId, instance.id(), instance.flowableProcessInstanceId());
        return List.copyOf(reusedTasks);
      }
      recordTaskEvent(tenantId, instance.id(), next, "created", null, null);
      if (next.getAssignee() == null || next.getAssignee().isBlank()) {
        taskService.claim(next.getId(), handler.userId());
        recordTaskEvent(
            tenantId, instance.id(), next, "claimed", handler.userId(), "按流程实例内已审工号自动认领");
      }
      String comment = "同一办理人（工号 " + handler.employeeNo()
          + "）已在本流程实例的节点「" + source.nodeName()
          + "（" + source.nodeId() + "）」审批通过，系统自动复用结论";
      taskService.complete(next.getId(), Map.of("approved", true, "reviewComment", comment));
      recordTaskEvent(tenantId, instance.id(), next, "approved", handler.userId(), comment);
      auditLogApplicationService.recordAutomatedTenantAction(
          tenantId,
          handler.userId(),
          "workflow.task.reused",
          instance.businessType(),
          instance.businessId(),
          "节点 " + next.getTaskDefinitionKey() + " 复用节点 " + source.nodeId()
              + " 的已通过结论，校验工号 " + handler.employeeNo());
      reusedTasks.add(new WorkflowReusedTask(
          next.getId(),
          next.getTaskDefinitionKey(),
          next.getName(),
          handler.userId(),
          handler.employeeNo(),
          source.flowableTaskId(),
          source.nodeId(),
          comment));
    }
    return List.copyOf(reusedTasks);
  }

  private SoleApprovalHandler soleApprovalHandler(Task task, String tenantId) {
    if (task.getAssignee() != null && !task.getAssignee().isBlank()) {
      BuyerUser assignee = buyerUserMapper.findByTenantAndId(tenantId, task.getAssignee());
      String employeeNo = approvalEmployeeNo(assignee);
      return employeeNo == null ? null : new SoleApprovalHandler(task.getAssignee(), employeeNo);
    }
    LinkedHashSet<String> candidateUserIds = new LinkedHashSet<>();
    String prefix = "role:" + tenantId + ":";
    for (IdentityLink link : taskService.getIdentityLinksForTask(task.getId())) {
      if (!"candidate".equals(link.getType())) continue;
      if (link.getUserId() != null && !link.getUserId().isBlank()) {
        candidateUserIds.add(link.getUserId());
      }
      if (link.getGroupId() != null && link.getGroupId().startsWith(prefix)) {
        candidateUserIds.addAll(buyerUserMapper.listActiveBuyerUserIdsByTenantAndRole(
            tenantId, link.getGroupId().substring(prefix.length())));
      }
    }
    LinkedHashMap<String, String> identities = new LinkedHashMap<>();
    for (String candidateUserId : candidateUserIds) {
      BuyerUser candidate = buyerUserMapper.findByTenantAndId(tenantId, candidateUserId);
      if (candidate == null || !"active".equals(candidate.status())) continue;
      String employeeNo = approvalEmployeeNo(candidate);
      if (employeeNo != null) {
        identities.putIfAbsent(employeeNo, candidateUserId);
      }
    }
    if (identities.size() != 1) {
      return null;
    }
    Map.Entry<String, String> sole = identities.entrySet().iterator().next();
    return new SoleApprovalHandler(sole.getValue(), sole.getKey());
  }

  private WorkflowTaskEvent findApprovedEventByEmployeeNo(
      String tenantId, String workflowInstanceId, String employeeNo) {
    List<WorkflowTaskEvent> events = workflowTaskEventMapper.listByTenantAndWorkflowInstance(
        tenantId, workflowInstanceId);
    var invalidated = events.stream().filter(event -> "approval_invalidated".equals(event.action()))
        .map(WorkflowTaskEvent::flowableTaskId).collect(java.util.stream.Collectors.toSet());
    for (int index = events.size() - 1; index >= 0; index--) {
      WorkflowTaskEvent event = events.get(index);
      if ("returned".equals(event.action())) break;
      if (invalidated.contains(event.flowableTaskId())) continue;
      if (!"approved".equals(event.action()) || event.actorId() == null) continue;
      BuyerUser actor = buyerUserMapper.findByTenantAndId(tenantId, event.actorId());
      if (employeeNo.equals(approvalEmployeeNo(actor))) {
        return event;
      }
    }
    return null;
  }

  private static String approvalEmployeeNo(BuyerUser user) {
    return user != null && user.employeeNo() != null && !user.employeeNo().isBlank()
        ? user.employeeNo().trim().toUpperCase()
        : null;
  }

  private boolean isVisible(WorkflowBusinessInstance instance, DataScope dataScope) {
    if (!dataScope.restricted()) {
      return true;
    }
    if (dataScope.requesterId() != null) {
      return dataScope.requesterId().equals(instance.initiatorId());
    }
    return instance.departmentId() != null && dataScope.departmentIds().contains(instance.departmentId());
  }

  // 需求等业务可直接传入业务部门；尚未建部门字段的企业级业务则在发起时固化发起人部门。
  // 这样任务数据范围、部门条件与部门主管办理规则始终基于同一份不可变实例归属。
  private String resolveWorkflowDepartmentId(String tenantId, String actorId, String requestedDepartmentId) {
    if (requestedDepartmentId != null && !requestedDepartmentId.isBlank()) {
      Department department = departmentMapper.findByTenantAndId(tenantId, requestedDepartmentId);
      if (department == null) {
        throw new IllegalArgumentException("Workflow department is not in tenant scope: " + requestedDepartmentId);
      }
      return requestedDepartmentId;
    }
    BuyerUser initiator = buyerUserMapper.findByTenantAndId(tenantId, actorId);
    if (initiator == null || !"active".equals(initiator.status())) {
      throw new IllegalStateException("Workflow initiator is not an active buyer user: " + actorId);
    }
    return initiator.departmentId();
  }

  private void bindDepartmentManagerAssignments(
      String tenantId,
      String departmentId,
      List<WorkflowDefinitionSchema.FlowStep> steps,
      Map<String, Object> variables) {
    for (WorkflowDefinitionSchema.FlowStep step : WorkflowExecutablePathResolver.resolve(steps, variables)) {
      if ("approver".equals(step.type())
          && "initiator_department_manager".equals(step.assignment().type())) {
        if (departmentId == null || departmentId.isBlank()) {
          throw new IllegalArgumentException("Department manager approval requires a business departmentId");
        }
        Department department = departmentMapper.findByTenantAndId(tenantId, departmentId);
        if (department == null || department.managerId() == null || department.managerId().isBlank()) {
          throw new IllegalStateException("Initiator department has no active manager configured: " + departmentId);
        }
        BuyerUser manager = buyerUserMapper.findByTenantAndId(tenantId, department.managerId());
        if (manager == null || !"active".equals(manager.status())) {
          throw new IllegalStateException("Initiator department manager is not an active buyer user: " + departmentId);
        }
        variables.put("assignee_" + step.id(), manager.id());
      }
    }
  }

  void recordCreatedTasks(String tenantId, String workflowInstanceId, String flowableProcessInstanceId) {
    WorkflowBusinessInstance instance = workflowBusinessInstanceMapper.findByTenantAndId(tenantId, workflowInstanceId);
    for (Task task : taskService.createTaskQuery()
        .processInstanceId(flowableProcessInstanceId)
        .active()
        .list()) {
      if (recordTaskEvent(tenantId, workflowInstanceId, task, "created", null, null) > 0 && instance != null) {
        notifyTaskRecipients(tenantId, task, instance);
      }
    }
  }

  private int recordTaskEvent(
      String tenantId,
      String workflowInstanceId,
      Task task,
      String action,
      String actorId,
      String comment) {
    return workflowTaskEventMapper.insert(
        "workflow-task-event-" + UUID.randomUUID(),
        tenantId,
        workflowInstanceId,
        task.getId(),
        task.getTaskDefinitionKey(),
        task.getName(),
        action,
        actorId,
        comment);
  }

  private void notifyTaskRecipients(
      String tenantId, Task task, WorkflowBusinessInstance instance) {
    notifyTaskRecipients(tenantId, task, instance, NotificationTitle.WORKFLOW_TASK_PENDING);
  }

  private int notifyTaskRecipients(String tenantId, Task task, WorkflowBusinessInstance instance, String title) {
    LinkedHashSet<String> recipients = new LinkedHashSet<>();
    if (task.getAssignee() != null && !task.getAssignee().isBlank()) {
      recipients.add(task.getAssignee());
    }
    for (IdentityLink link : taskService.getIdentityLinksForTask(task.getId())) {
      if (!"candidate".equals(link.getType())) {
        continue;
      }
      if (link.getUserId() != null && !link.getUserId().isBlank()) {
        recipients.add(link.getUserId());
      }
      String groupId = link.getGroupId();
      String prefix = "role:" + tenantId + ":";
      if (groupId != null && groupId.startsWith(prefix)) {
        recipients.addAll(buyerUserMapper.listActiveBuyerUserIdsByTenantAndRole(
            tenantId, groupId.substring(prefix.length())));
      }
    }
    recipients.removeIf(userId -> initiatorHandlingBlocked(instance,userId) || !isVisible(
        instance, dataScopeService.userDataScope(tenantId, userId)));
    notificationApplicationService.notifyTenantUsers(
        tenantId,
        recipients,
        title,
        task.getName() + "待办理：" + workflowBusinessName(instance.businessType()) + " " + instance.businessId());
    return recipients.size();
  }

  @Transactional
  public void remindOverdueTask(String taskId) {
    Task candidate = taskService.createTaskQuery().taskId(taskId).active().singleResult();
    if (candidate == null || candidate.getTenantId() == null) return;
    var instance = workflowBusinessInstanceMapper.findByTenantAndFlowableProcessInstanceId(candidate.getTenantId(), candidate.getProcessInstanceId());
    if (instance == null) return;
    instance = workflowBusinessInstanceMapper.findByTenantAndIdForUpdate(instance.tenantId(), instance.id());
    Task task = taskService.createTaskQuery().taskId(taskId).active().singleResult();
    if (instance == null || !"processing".equals(instance.status()) || task == null || task.getDueDate() == null
        || task.getDueDate().after(new java.util.Date())) return;
    String due = Long.toString(task.getDueDate().getTime());
    if (due.equals(taskService.getVariableLocal(taskId, "deadlineNotifiedFor"))) return;
    if (notifyTaskRecipients(instance.tenantId(), task, instance, "审批任务超期提醒") == 0) return;
    taskService.setVariableLocal(taskId, "deadlineNotifiedFor", due);
    workflowTaskEventMapper.insert("workflow-overdue-" + UUID.randomUUID(), instance.tenantId(), instance.id(), null,
        task.getTaskDefinitionKey(), task.getName(), "reminded", null, "系统超期提醒；任务=" + taskId + "；办理时限=" + task.getDueDate());
    // The actorless workflow event records the scheduler honestly, without impersonating a user.
  }

  private Task firstActiveTask(String flowableProcessInstanceId) {
    return taskService.createTaskQuery()
        .processInstanceId(flowableProcessInstanceId)
        .active()
        .orderByTaskCreateTime().asc()
        .list()
        .stream()
        .findFirst()
        .orElse(null);
  }

  private UnifiedWorkflowTaskResponse toTaskResponse(Task task, WorkflowBusinessInstance instance) {
    String groupPrefix = "role:" + instance.tenantId() + ":";
    List<IdentityLink> identityLinks = taskService.getIdentityLinksForTask(task.getId());
    List<String> candidateUserIds = identityLinks.stream()
        .filter(link -> "candidate".equals(link.getType()) && link.getUserId() != null)
        .map(IdentityLink::getUserId)
        .toList();
    List<String> candidateRoleIds = identityLinks.stream()
        .filter(link -> "candidate".equals(link.getType()) && link.getGroupId() != null)
        .map(IdentityLink::getGroupId)
        .filter(group -> group.startsWith(groupPrefix))
        .map(group -> group.substring(groupPrefix.length()))
        .toList();
    OffsetDateTime createdAt = task.getCreateTime() == null
        ? null
        : OffsetDateTime.ofInstant(task.getCreateTime().toInstant(), ZoneOffset.UTC);
    return new UnifiedWorkflowTaskResponse(
        task.getId(),
        instance.id(),
        instance.businessType(),
        instance.businessId(),
        task.getName(),
        task.getTaskDefinitionKey(),
        task.getAssignee(),
        candidateUserIds,
        candidateRoleIds,
        instance.amount(),
        instance.departmentId(),
        createdAt);
  }

  private WorkflowInstanceHistoryResponse toHistoryResponse(
      String tenantId, WorkflowBusinessInstance instance) {
    WorkflowDefinitionVersion version = workflowDefinitionPublicationService.findVersion(
        tenantId, instance.definitionVersionId());
    List<WorkflowTaskEvent> rawEvents = workflowTaskEventMapper.listByTenantAndWorkflowInstance(tenantId, instance.id());
    var invalidated = rawEvents.stream().filter(event -> "approval_invalidated".equals(event.action()))
        .map(WorkflowTaskEvent::flowableTaskId).collect(java.util.stream.Collectors.toSet());
    List<WorkflowTaskEventResponse> events = rawEvents.stream()
        .map(event -> {
          var response = toTaskEventResponse(event);
          return "approved".equals(event.action()) && invalidated.contains(event.flowableTaskId())
              ? response.superseded() : response;
        })
        .toList();
    BuyerUser initiator = buyerUserMapper.findByTenantAndId(tenantId, instance.initiatorId());
    BuyerUser completedBy = instance.completedBy() == null
        ? null
        : buyerUserMapper.findByTenantAndId(tenantId, instance.completedBy());
    Task activeTask = activeTask(instance);
    return new WorkflowInstanceHistoryResponse(
        instance.id(),
        instance.businessType(),
        instance.businessId(),
        instance.definitionVersionId(),
        instance.flowableProcessInstanceId(),
        instance.status(),
        instance.initiatorId(),
        initiator == null ? null : initiator.name(),
        instance.completedBy(),
        completedBy == null ? null : completedBy.name(),
        instance.departmentId(),
        instance.amount(),
        readJson(instance.formData()),
        version == null ? null : version.formSchema(),
        readJson(instance.businessSnapshot()),
        workflowAttachments(tenantId, instance),
        activeTask == null ? null : toTaskResponse(activeTask, instance),
        instance.createdAt(),
        instance.completedAt(),
        events,
        version == null ? null : version.flowSchema());
  }

  private WorkflowInstanceLedgerResponse toLedgerResponse(
      String tenantId, WorkflowBusinessInstance instance) {
    Task task = activeTask(instance);
    return toLedgerResponse(tenantId, instance, task == null ? null : toTaskResponse(task, instance));
  }

  private WorkflowInstanceLedgerResponse toLedgerResponse(
      String tenantId, WorkflowBusinessInstance instance, UnifiedWorkflowTaskResponse currentTask) {
    BuyerUser initiator = buyerUserMapper.findByTenantAndId(tenantId, instance.initiatorId());
    BuyerUser completedBy = instance.completedBy() == null
        ? null
        : buyerUserMapper.findByTenantAndId(tenantId, instance.completedBy());
    return new WorkflowInstanceLedgerResponse(
        instance.id(),
        instance.businessType(),
        instance.businessId(),
        instance.definitionVersionId(),
        instance.status(),
        instance.initiatorId(),
        initiator == null ? null : initiator.name(),
        instance.completedBy(),
        completedBy == null ? null : completedBy.name(),
        instance.departmentId(),
        instance.amount(),
        currentTask,
        instance.createdAt(),
        instance.completedAt(),
        instance.updatedAt());
  }

  private Task activeTask(WorkflowBusinessInstance instance) {
    if (!WorkflowInstanceStatus.PROCESSING.equals(instance.status())) {
      return null;
    }
    return taskService.createTaskQuery()
        .processInstanceId(instance.flowableProcessInstanceId())
        .active()
        .orderByTaskCreateTime().asc()
        .list()
        .stream()
        .findFirst()
        .orElse(null);
  }

  private List<WorkflowAttachmentResponse> workflowAttachments(
      String tenantId, WorkflowBusinessInstance instance) {
    Map<String, Object> snapshot = readJson(instance.businessSnapshot());
    LinkedHashMap<String, String> owners = new LinkedHashMap<>();
    owners.put(instance.businessType(), instance.businessId());
    completionHandlers.stream().filter(handler -> handler.businessType().equals(instance.businessType()))
        .flatMap(handler -> handler.attachmentOwnerTypes().stream()).forEach(type -> owners.put(type, instance.businessId()));
    switch (instance.businessType()) {
      case "order_settlement" -> putOwner(owners,"order_settlement_document",snapshot.get("orderId"));
      case "frozen_payment_correction" -> {putOwner(owners,"invoice",snapshot.get("invoiceId"));putOwner(owners,"procurement_project",snapshot.get("projectId"));}
      case "funding_change" -> putOwner(owners,"procurement_project",snapshot.get("projectId"));
      case "project_initiation" -> owners.put("procurement_project",instance.businessId());
      case "project_change" -> {owners.put("procurement_project_change",instance.businessId());putOwner(owners,"procurement_project",snapshot.get("projectId"));}
      case "project_carryover", "project_liquidation", "project_reopen" -> putOwner(owners,"procurement_project",snapshot.get("projectId"));
      case "purchase_demand" -> owners.put("purchase_demand", instance.businessId());
      case "buyer_supplier_admission", "buyer_supplier_exit", "supplier_qualification_change" -> putOwner(owners, "supplier", snapshot.get("supplierId"));
      case "rfq_award" -> putOwner(owners, "rfq", snapshot.get("rfqId"));
      case "contract_approval" -> owners.put("contract", instance.businessId());
      case "payment_request" -> putOwner(owners, "invoice", snapshot.get("invoiceId"));
      case "payment_batch" -> owners.put("payment_batch", instance.businessId());
      case "payment_archive_exception" -> putOwner(owners, "payment_batch", snapshot.get("paymentBatchNo"));
      default -> {
      }
    }
    LinkedHashMap<String, Attachment> attachments = new LinkedHashMap<>();
    owners.forEach((ownerType, ownerId) -> attachmentMapper
        .listActiveByTenantAndOwner(tenantId, ownerType, ownerId)
        .forEach(attachment -> attachments.putIfAbsent(attachment.id(), attachment)));
    return attachments.values().stream()
        .map(attachment -> new WorkflowAttachmentResponse(
            attachment.id(),
            attachment.ownerType(),
            attachment.ownerId(),
            attachment.fileName(),
            attachment.visibility(),
            attachment.createdAt()))
        .toList();
  }

  private static void putOwner(Map<String, String> owners, String ownerType, Object ownerId) {
    if (ownerId != null && !String.valueOf(ownerId).isBlank()) {
      owners.put(ownerType, String.valueOf(ownerId));
    }
  }

  private static String workflowBusinessName(String businessType) {
    return switch (businessType) {
      case "order_settlement" -> "合同解除与订单清算";
      case "project_initiation" -> "项目立项";
      case "project_change" -> "立项变更";
      case "project_carryover" -> "跨年度承接";
      case "frozen_payment_correction" -> "跨年冻结付款更正";
      case "funding_change" -> "专项资金与项目分摊";
      case "project_liquidation" -> "项目终止清算";
      case "project_reopen" -> "项目及分包受控重开";
      case "purchase_demand" -> "采购需求";
      case "budget_change" -> "预算编制与调整";
      case "budget_exception" -> "超预算例外";
      case "buyer_supplier_admission" -> "供应商准入";
      case "buyer_supplier_exit" -> "供应商退出";
      case "supplier_qualification_change" -> "供应商资质变更";
      case "rfq_award" -> "询价定标";
      case "contract_approval" -> "合同审批";
      case "payment_request" -> "付款申请";
      case "payment_batch" -> "付款批次";
      case "payment_archive_exception" -> "付款归档例外";
      case "ludong_project_application" -> "鲁东大学货物类采购申报";
      default -> businessType;
    };
  }

  private WorkflowTaskEventResponse toTaskEventResponse(WorkflowTaskEvent event) {
    BuyerUser actor = event.actorId() == null
        ? null
        : buyerUserMapper.findByTenantAndId(event.tenantId(), event.actorId());
    return new WorkflowTaskEventResponse(
        event.id(),
        event.flowableTaskId(),
        event.nodeId(),
        event.nodeName(),
        event.action(),
        event.actorId(),
        actor == null ? null : actor.name(),
        event.comment(),
        event.createdAt());
  }

  private static boolean decision(String action) {
    if ("approve".equalsIgnoreCase(action)) {
      return true;
    }
    if ("reject".equalsIgnoreCase(action)) {
      return false;
    }
    throw new IllegalArgumentException("Workflow action must be approve or reject");
  }

  private String writeJson(Map<String, Object> value) {
    try {
      return objectMapper.writeValueAsString(value);
    } catch (Exception exception) {
      throw new IllegalStateException("Cannot serialize workflow data", exception);
    }
  }

  private Map<String, Object> readJson(String value) {
    try {
      return objectMapper.readValue(value == null || value.isBlank() ? "{}" : value, MAP_TYPE);
    } catch (Exception exception) {
      return Map.of();
    }
  }

  private record SoleApprovalHandler(String userId, String employeeNo) {
  }

  private record TaskCompletionOutcome(
      WorkflowInstanceHistoryResponse history,
      List<WorkflowReusedTask> reusedTasks) {
  }
}
