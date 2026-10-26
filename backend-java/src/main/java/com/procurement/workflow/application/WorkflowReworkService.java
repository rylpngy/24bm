package com.procurement.workflow.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.workflow.definition.WorkflowExecutablePathResolver;
import com.procurement.workflow.definition.WorkflowSchemaValidator;
import com.procurement.workflow.domain.WorkflowAdditionalReview;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import com.procurement.workflow.infrastructure.WorkflowAdditionalReviewMapper;
import com.procurement.workflow.infrastructure.WorkflowBusinessInstanceMapper;
import com.procurement.workflow.infrastructure.WorkflowTaskEventMapper;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.TaskService;
import org.flowable.task.api.DelegationState;
import org.flowable.task.api.Task;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WorkflowReworkService {
  public record ReturnTarget(String nodeId, String name) {}
  private record Context(String tenant, String actor, WorkflowBusinessInstance instance, Task task) {}
  private final UnifiedWorkflowApplicationService workflows;
  private final WorkflowTaskOperationService operations;
  private final WorkflowBusinessInstanceMapper instances;
  private final WorkflowTaskEventMapper events;
  private final WorkflowAdditionalReviewMapper additional;
  private final WorkflowDefinitionPublicationService definitions;
  private final WorkflowSchemaValidator validator;
  private final RuntimeService runtime;
  private final TaskService tasks;
  private final NotificationApplicationService notifications;
  private final AuditLogApplicationService audit;
  private final ObjectMapper json;

  public WorkflowReworkService(UnifiedWorkflowApplicationService workflows, WorkflowTaskOperationService operations,
      WorkflowBusinessInstanceMapper instances, WorkflowTaskEventMapper events, WorkflowAdditionalReviewMapper additional,
      WorkflowDefinitionPublicationService definitions, WorkflowSchemaValidator validator, RuntimeService runtime,
      TaskService tasks, NotificationApplicationService notifications, AuditLogApplicationService audit, ObjectMapper json) {
    this.workflows=workflows; this.operations=operations; this.instances=instances; this.events=events;
    this.additional=additional; this.definitions=definitions; this.validator=validator; this.runtime=runtime;
    this.tasks=tasks; this.notifications=notifications; this.audit=audit; this.json=json;
  }

  @Transactional
  public List<ReturnTarget> returnTargets(String taskId) {
    Context c = context(taskId);
    return returnTargets(c);
  }

  @Transactional
  public WorkflowAdditionalReview currentAdditional(String taskId) {
    Context c = context(taskId);
    return additional.pending(c.tenant(), taskId);
  }

  @Transactional
  public WorkflowAdditionalReview requestAdditional(String taskId, String reviewerId, String reason) {
    requireReason(reason);
    Context c = context(taskId);
    requirePrincipal(c);
    if (Boolean.TRUE.equals(tasks.getVariableLocal(taskId, "additionalReviewRejected"))) {
      throw new IllegalStateException("加审不同意后须先退回或驳回，不能重新加审覆盖原结论");
    }
    if (operations.recipients(taskId).stream().noneMatch(user -> user.id().equals(reviewerId))) {
      throw new PermissionDeniedException("加审人不属于可办理当前事项的有效人员");
    }
    String id = "additional-" + UUID.randomUUID();
    if (c.task().getAssignee() == null || c.task().getAssignee().isBlank()) {
      tasks.claim(taskId, c.actor());
      record(c, taskId, "claimed", "发起加审前认领原任务");
    }
    tasks.setOwner(taskId, c.actor());
    tasks.delegateTask(taskId, reviewerId);
    additional.insert(id, c.tenant(), c.instance().id(), taskId, c.task().getTaskDefinitionKey(), c.actor(), reviewerId, reason.strip());
    record(c, null, "additional_requested", "加审人=" + reviewerId + "；" + reason.strip());
    notifications.notifyTenantUsers(c.tenant(), List.of(reviewerId), "审批加审待办", c.task().getName() + "；" + c.instance().businessId() + "；" + reason.strip());
    audit.recordCurrentTenantAction("workflow.additional.requested", c.instance().businessType(), c.instance().businessId(), reason.strip());
    return additional.pending(c.tenant(), taskId);
  }

  @Transactional
  public void completeAdditional(String taskId, String reviewId, boolean approved, String comment) {
    requireReason(comment);
    Context c = context(taskId);
    WorkflowAdditionalReview review = additional.pending(c.tenant(), taskId);
    if (!DelegationState.PENDING.equals(c.task().getDelegationState()) || review == null || !review.id().equals(reviewId)
        || !review.reviewerId().equals(c.actor())) throw new PermissionDeniedException("加审任务已变化或当前用户不是加审人");
    String data;
    try {
      data = json.writeValueAsString(Map.of("opinion", approved ? "同意" : "不同意", "comment", comment.strip(),
          "reviewerId", c.actor(), "originalNodeId", review.nodeId()));
    } catch (JsonProcessingException exception) { throw new IllegalStateException("无法保存加审表单", exception); }
    if (additional.complete(c.tenant(), reviewId, c.actor(), approved ? "approved" : "rejected", data) != 1) {
      throw new IllegalStateException("加审已办理，请刷新");
    }
    tasks.resolveTask(taskId);
    tasks.setVariableLocal(taskId, "additionalReviewRejected", !approved);
    record(c, null, approved ? "additional_approved" : "additional_rejected", "加审记录=" + reviewId + "；" + comment.strip());
    notifications.notifyTenantUsers(c.tenant(), List.of(review.requestedBy()), "加审意见已返回",
        c.task().getName() + "；" + (approved ? "加审同意，原办理人继续审核" : "加审不同意，请退回或驳回") + "；" + comment.strip());
    audit.recordCurrentTenantAction("workflow.additional.completed", c.instance().businessType(), c.instance().businessId(), data);
  }

  @Transactional
  public void returnTask(String taskId, String targetNodeId, String reason) {
    requireReason(reason);
    Context c = context(taskId);
    requirePrincipal(c);
    ReturnTarget target = returnTargets(c).stream().filter(item -> item.nodeId().equals(targetNodeId)).findFirst()
        .orElseThrow(() -> new IllegalArgumentException("只能退回当前实际路径上已办理的前序节点"));
    List<ReturnTarget> path = approvalPath(c);
    int targetIndex = index(path, targetNodeId);
    var oldEvents = events.listByTenantAndWorkflowInstance(c.tenant(), c.instance().id());
    Set<String> invalidated = oldEvents.stream().filter(event -> "approval_invalidated".equals(event.action()))
        .map(event -> event.flowableTaskId()).collect(Collectors.toSet());
    record(c, taskId, "returned", "退回节点=" + target.nodeId() + "（" + target.name() + "）；" + reason.strip());
    for (var event : oldEvents) {
      if ("approved".equals(event.action()) && event.flowableTaskId() != null && !invalidated.contains(event.flowableTaskId())
          && index(path, event.nodeId()) >= targetIndex) {
        events.insert("workflow-invalidated-" + UUID.randomUUID(), c.tenant(), c.instance().id(), event.flowableTaskId(),
            event.nodeId(), event.nodeName(), "approval_invalidated", c.actor(), "退回后须重新办理；" + reason.strip());
      }
    }
    runtime.createChangeActivityStateBuilder().processInstanceId(c.instance().flowableProcessInstanceId())
        .moveActivityIdTo(c.task().getTaskDefinitionKey(), target.nodeId()).changeState();
    var active = tasks.createTaskQuery().processInstanceId(c.instance().flowableProcessInstanceId()).active().list();
    if (active.size() != 1 || !target.nodeId().equals(active.getFirst().getTaskDefinitionKey())) {
      throw new IllegalStateException("Flowable未回到指定节点，已回滚操作");
    }
    workflows.recordCreatedTasks(c.tenant(), c.instance().id(), c.instance().flowableProcessInstanceId());
    audit.recordCurrentTenantAction("workflow.task.returned", c.instance().businessType(), c.instance().businessId(),
        "退回=" + target.nodeId() + "；" + reason.strip());
  }

  public List<WorkflowAdditionalReview> additionalHistory(String instanceId) {
    workflows.getCurrentTenantHistory(instanceId);
    return additional.list(TenantAccessGuard.requireTenantId("additional history"), instanceId);
  }

  private Context context(String taskId) {
    var authorized = workflows.requireCurrentUserTask(taskId);
    String tenant = TenantAccessGuard.requireTenantId("workflow rework");
    String actor = TenantAccessGuard.requireUserId("workflow rework");
    var instance = instances.findByTenantAndIdForUpdate(tenant, authorized.workflowInstanceId());
    workflows.requireCurrentUserTask(taskId);
    if (instance == null || !"processing".equals(instance.status()) || !workflows.supportsTaskRework(instance.businessType())) {
      throw new IllegalStateException("该业务尚未接通退回或加审的业务投影，不能绕过业务入口操作");
    }
    Task task = tasks.createTaskQuery().taskId(taskId).active().singleResult();
    if (task == null || !instance.flowableProcessInstanceId().equals(task.getProcessInstanceId())) {
      throw new IllegalStateException("审批任务已变化，请刷新");
    }
    return new Context(tenant, actor, instance, task);
  }

  private void requirePrincipal(Context c) {
    if (DelegationState.PENDING.equals(c.task().getDelegationState())) throw new IllegalStateException("加审办理中，不能转审、退回或重复加审");
  }

  private List<ReturnTarget> returnTargets(Context c) {
    if (DelegationState.PENDING.equals(c.task().getDelegationState())) return List.of();
    List<ReturnTarget> path = approvalPath(c);
    int current = index(path, c.task().getTaskDefinitionKey());
    if (current < 0) throw new IllegalStateException("当前节点不在已发布版本的实际路径中");
    var history = events.listByTenantAndWorkflowInstance(c.tenant(), c.instance().id());
    Set<String> invalidated = history.stream().filter(event -> "approval_invalidated".equals(event.action()))
        .map(event -> event.flowableTaskId()).collect(Collectors.toSet());
    Set<String> completed = history.stream().filter(event -> "approved".equals(event.action()) && !invalidated.contains(event.flowableTaskId()))
        .map(event -> event.nodeId()).collect(Collectors.toSet());
    return path.subList(0, current).stream().filter(item -> completed.contains(item.nodeId())).toList();
  }

  private List<ReturnTarget> approvalPath(Context c) {
    if (tasks.createTaskQuery().processInstanceId(c.instance().flowableProcessInstanceId()).active().count() != 1) {
      throw new IllegalStateException("本次退回仅支持单活动节点串行流程，不对并行分支执行不安全跳转");
    }
    var version = definitions.findVersion(c.tenant(), c.instance().definitionVersionId());
    if (version == null) throw new IllegalStateException("原流程版本不存在");
    var schema = validator.validate(c.tenant(), version.formSchema(), version.flowSchema());
    return WorkflowExecutablePathResolver.resolve(schema.steps(), runtime.getVariables(c.instance().flowableProcessInstanceId()))
        .stream().filter(step -> "approver".equals(step.type()))
        .map(step -> new ReturnTarget("task_" + step.id(), step.title())).toList();
  }

  private static int index(List<ReturnTarget> path, String id) {
    for (int i=0; i<path.size(); i++) if (path.get(i).nodeId().equals(id)) return i;
    return -1;
  }
  private static void requireReason(String reason) {
    if (reason == null || reason.isBlank() || reason.length() > 1000) throw new IllegalArgumentException("操作说明必填且不得超过1000字");
  }
  private void record(Context c, String taskId, String action, String comment) {
    events.insert("workflow-event-" + UUID.randomUUID(), c.tenant(), c.instance().id(), taskId,
        c.task().getTaskDefinitionKey(), c.task().getName(), action, c.actor(), comment);
  }
}
