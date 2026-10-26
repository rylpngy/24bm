package com.procurement.workflow.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.identity.application.DataScopeService;
import com.procurement.identity.application.PermissionService;
import com.procurement.identity.domain.BuyerUser;
import com.procurement.identity.domain.DataScope;
import com.procurement.identity.infrastructure.BuyerUserMapper;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.workflow.api.WorkflowTaskOperationRequest;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import com.procurement.workflow.infrastructure.WorkflowBusinessInstanceMapper;
import com.procurement.workflow.infrastructure.WorkflowTaskEventMapper;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Date;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.flowable.engine.TaskService;
import org.flowable.task.api.Task;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WorkflowTaskOperationService {
  public record Recipient(String id, String name, String employeeNo) {}
  public record TaskTiming(String taskId, OffsetDateTime dueAt) {}
  private final UnifiedWorkflowApplicationService workflows;
  private final WorkflowBusinessInstanceMapper instances;
  private final WorkflowTaskEventMapper events;
  private final TaskService tasks;
  private final BuyerUserMapper users;
  private final PermissionService permissions;
  private final DataScopeService scopes;
  private final NotificationApplicationService notifications;
  private final AuditLogApplicationService audit;

  public WorkflowTaskOperationService(UnifiedWorkflowApplicationService workflows,
      WorkflowBusinessInstanceMapper instances, WorkflowTaskEventMapper events, TaskService tasks,
      BuyerUserMapper users, PermissionService permissions, DataScopeService scopes,
      NotificationApplicationService notifications, AuditLogApplicationService audit) {
    this.workflows = workflows; this.instances = instances; this.events = events;
    this.tasks = tasks; this.users = users; this.permissions = permissions; this.scopes = scopes;
    this.notifications = notifications; this.audit = audit;
  }

  @Transactional
  public List<Recipient> recipients(String taskId) {
    var context = workflows.requireCurrentUserTask(taskId);
    String tenant = TenantAccessGuard.requireTenantId("workflow task recipients");
    var instance = instances.findByTenantAndId(tenant, context.workflowInstanceId());
    return users.listByTenant(tenant).stream()
        .filter(user -> !user.id().equals(TenantAccessGuard.requireUserId("workflow task recipients")))
        .filter(user -> eligible(instance, user, true))
        .map(user -> new Recipient(user.id(), user.name(), user.employeeNo())).toList();
  }

  @Transactional
  public void remindInstance(String workflowInstanceId, String reason) {
    if (reason == null || reason.isBlank() || reason.length() > 1000) throw new IllegalArgumentException("请填写1000字以内催办说明");
    workflows.getCurrentTenantHistory(workflowInstanceId);
    String tenant = TenantAccessGuard.requireTenantId("workflow reminder");
    String actor = TenantAccessGuard.requireUserId("workflow reminder");
    var instance = instances.findByTenantAndIdForUpdate(tenant, workflowInstanceId);
    if (instance == null || !"processing".equals(instance.status())) throw new IllegalStateException("仅可催办在审流程");
    if (!actor.equals(instance.initiatorId()) && !permissions.currentUserHas("buyer:workflow:manage")) {
      throw new PermissionDeniedException("只有发起人或流程管理员可以催办");
    }
    boolean recent = events.listByTenantAndWorkflowInstance(tenant, instance.id()).stream()
        .anyMatch(event -> "reminded".equals(event.action()) && actor.equals(event.actorId())
            && event.createdAt().isAfter(OffsetDateTime.now().minusMinutes(1)));
    if (recent) throw new IllegalStateException("刚刚已催办，请稍后再试");
    for (Task task : tasks.createTaskQuery().processInstanceId(instance.flowableProcessInstanceId()).active().list()) {
      var recipients = new java.util.LinkedHashSet<String>();
      if (task.getAssignee() != null) recipients.add(task.getAssignee());
      else for (var link : tasks.getIdentityLinksForTask(task.getId())) {
        if (!"candidate".equals(link.getType())) continue;
        if (link.getUserId() != null) recipients.add(link.getUserId());
        String prefix = "role:" + tenant + ":";
        if (link.getGroupId() != null && link.getGroupId().startsWith(prefix)) {
          recipients.addAll(users.listActiveBuyerUserIdsByTenantAndRole(tenant, link.getGroupId().substring(prefix.length())));
        }
      }
      recipients.removeIf(id -> !eligible(instance, users.findByTenantAndId(tenant, id), true));
      if (recipients.isEmpty()) throw new IllegalStateException("当前节点没有可通知的有效办理人，请联系流程管理员");
      notifications.notifyTenantUsers(tenant, recipients, "审批任务催办", task.getName() + "；" + instance.businessId() + "；" + reason);
      events.insert("workflow-reminder-" + UUID.randomUUID(), tenant, instance.id(), null,
          task.getTaskDefinitionKey(), task.getName(), "reminded", actor, "催办当前办理人；" + reason);
    }
    audit.recordCurrentTenantAction("workflow.instance.remind", instance.businessType(), instance.businessId(), reason);
  }

  @Transactional
  public TaskTiming timing(String taskId) {
    workflows.requireCurrentUserTask(taskId);
    Task task = tasks.createTaskQuery().taskId(taskId).active().singleResult();
    if (task == null) throw new IllegalStateException("审批任务已变化，请刷新");
    return new TaskTiming(taskId, task.getDueDate() == null ? null
        : task.getDueDate().toInstant().atOffset(ZoneOffset.UTC));
  }

  @Transactional
  public void operate(String taskId, WorkflowTaskOperationRequest request) {
    if (!Set.of("transfer", "copy", "remind", "deadline").contains(request.action())) {
      throw new IllegalArgumentException("不支持的任务操作");
    }
    var context = workflows.requireCurrentUserTask(taskId);
    String tenant = TenantAccessGuard.requireTenantId("workflow task operation");
    String actor = TenantAccessGuard.requireUserId("workflow task operation");
    var instance = instances.findByTenantAndIdForUpdate(tenant, context.workflowInstanceId());
    // Recheck after taking the instance lock: a concurrent completion/transfer must not leave stale authority.
    workflows.requireCurrentUserTask(taskId);
    Task task = tasks.createTaskQuery().taskId(taskId).active().singleResult();
    if (task == null) throw new IllegalStateException("审批任务已变化，请刷新");
    List<String> recipientIds = request.recipientIds() == null ? List.of() : request.recipientIds().stream().distinct().toList();
    String event;
    String detail = request.reason();
    switch (request.action()) {
      case "transfer", "copy" -> {
        boolean transfer = "transfer".equals(request.action());
        if (recipientIds.isEmpty() || (transfer && recipientIds.size() != 1)) {
          throw new IllegalArgumentException(transfer ? "转审须选择一位办理人" : "请选择抄送人");
        }
        for (String id : recipientIds) {
          if (actor.equals(id) || !eligible(instance, users.findByTenantAndId(tenant, id), transfer)) {
            throw new PermissionDeniedException("接收人须为本企业有权限及数据范围的其他有效用户");
          }
        }
        if (transfer) tasks.setAssignee(taskId, recipientIds.getFirst());
        event = transfer ? "transferred" : "copied";
        detail += "；接收人=" + String.join(",", recipientIds);
        notifications.notifyTenantUsers(tenant, recipientIds, transfer ? "审批任务转审" : "审批事项抄送",
            task.getName() + "；" + instance.businessId() + "；" + request.reason());
      }
      case "deadline" -> {
        if (request.dueAt() == null || !request.dueAt().isAfter(OffsetDateTime.now())) {
          throw new IllegalArgumentException("办理时限必须是未来时间");
        }
        Date previousDueAt = task.getDueDate();
        tasks.setDueDate(taskId, Date.from(request.dueAt().toInstant()));
        event = "deadline_changed";
        detail += "；原时限=" + previousDueAt + "；新时限=" + request.dueAt();
      }
      default -> {
        if (instance.initiatorId().equals(actor)) throw new IllegalArgumentException("不能向自己催办");
        notifications.notifyTenantUsers(tenant, List.of(instance.initiatorId()), "审批补件催办",
            task.getName() + "；" + instance.businessId() + "；" + request.reason());
        event = "reminded";
        detail += "；通知发起人=" + instance.initiatorId();
      }
    }
    // Operations may repeat legitimately; null task ID avoids the one-decision-per-task unique index.
    events.insert("workflow-op-" + UUID.randomUUID(), tenant, instance.id(), null,
        task.getTaskDefinitionKey(), task.getName(), event, actor, "任务=" + taskId + "；" + detail);
    audit.recordCurrentTenantAction("workflow.task." + request.action(), instance.businessType(), instance.businessId(), detail);
  }

  private boolean eligible(WorkflowBusinessInstance instance, BuyerUser user, boolean review) {
    if (user == null || !"active".equals(user.status()) || !instance.tenantId().equals(user.tenantId())) return false;
    if (!permissions.userHas(user.id(), review ? "buyer:workflow:review" : "buyer:workflow:read")) return false;
    if ("ludong_project_application".equals(instance.businessType())
        && !permissions.userHas(user.id(), review ? "buyer:ludong-poc:review" : "buyer:ludong-poc:read")) return false;
    DataScope scope = scopes.userDataScope(instance.tenantId(), user.id());
    boolean visible = !scope.restricted() || (scope.requesterId() != null
        ? scope.requesterId().equals(instance.initiatorId())
        : instance.departmentId() != null && scope.departmentIds().contains(instance.departmentId()));
    return visible && (!review || !instance.initiatorId().equals(user.id())
        || !workflows.initiatorRequiresIndependentApprover(instance.businessType()));
  }
}
