package com.procurement.workflow.application;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.common.tenant.TenantContext;
import com.procurement.identity.application.DataScopeService;
import com.procurement.identity.application.PermissionService;
import com.procurement.identity.domain.BuyerUser;
import com.procurement.identity.domain.DataScope;
import com.procurement.identity.infrastructure.BuyerUserMapper;
import com.procurement.notification.application.NotificationApplicationService;
import com.procurement.workflow.api.UnifiedWorkflowTaskResponse;
import com.procurement.workflow.api.WorkflowTaskOperationRequest;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import com.procurement.workflow.infrastructure.WorkflowBusinessInstanceMapper;
import com.procurement.workflow.infrastructure.WorkflowTaskEventMapper;
import java.time.OffsetDateTime;
import java.util.List;
import org.flowable.engine.TaskService;
import org.flowable.task.api.Task;
import org.flowable.task.api.TaskQuery;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class WorkflowTaskOperationServiceTest {
  private final UnifiedWorkflowApplicationService workflows = mock(UnifiedWorkflowApplicationService.class);
  private final WorkflowBusinessInstanceMapper instances = mock(WorkflowBusinessInstanceMapper.class);
  private final WorkflowTaskEventMapper events = mock(WorkflowTaskEventMapper.class);
  private final TaskService tasks = mock(TaskService.class);
  private final BuyerUserMapper users = mock(BuyerUserMapper.class);
  private final PermissionService permissions = mock(PermissionService.class);
  private final DataScopeService scopes = mock(DataScopeService.class);
  private final NotificationApplicationService notifications = mock(NotificationApplicationService.class);
  private final AuditLogApplicationService audit = mock(AuditLogApplicationService.class);
  private final WorkflowTaskOperationService service = new WorkflowTaskOperationService(
      workflows, instances, events, tasks, users, permissions, scopes, notifications, audit);
  private final WorkflowBusinessInstance instance = new WorkflowBusinessInstance("w", "t", "ludong_project_application",
      "a", "v", "p", "processing", "initiator", "dept", null, "{}", "{}", null, null, null, null);

  @BeforeEach void setup() {
    TenantContext.set("t", null, "actor");
    when(workflows.requireCurrentUserTask("task")).thenReturn(new UnifiedWorkflowTaskResponse(
        "task", "w", "ludong_project_application", "a", "审核", "task_review", "actor", List.of(), List.of(), null, "dept", null));
    when(instances.findByTenantAndIdForUpdate("t", "w")).thenReturn(instance);
    TaskQuery query = mock(TaskQuery.class, RETURNS_SELF);
    Task task = mock(Task.class);
    when(tasks.createTaskQuery()).thenReturn(query); when(query.singleResult()).thenReturn(task);
    when(task.getTaskDefinitionKey()).thenReturn("task_review"); when(task.getName()).thenReturn("审核");
    when(users.findByTenantAndId("t", "recipient")).thenReturn(
        new BuyerUser("recipient", "t", "办理人", null, null, "active", "dept", "r"));
    when(permissions.userHas(eq("recipient"), anyString())).thenReturn(true);
    when(scopes.userDataScope("t", "recipient")).thenReturn(DataScope.unrestricted());
  }
  @AfterEach void clear() { TenantContext.clear(); }

  @Test void transferChangesRealAssigneeAndPreservesAudit() {
    service.operate("task", new WorkflowTaskOperationRequest("transfer", List.of("recipient"), "专业审核", null));
    verify(tasks).setAssignee("task", "recipient");
    verify(events).insert(anyString(), eq("t"), eq("w"), isNull(), eq("task_review"), eq("审核"), eq("transferred"), eq("actor"), contains("recipient"));
    verify(audit).recordCurrentTenantAction(eq("workflow.task.transfer"), eq("ludong_project_application"), eq("a"), anyString());
    verify(workflows, times(2)).requireCurrentUserTask("task");
  }
  @Test void copyDoesNotChangeAssigneeOrCompleteTask() {
    service.operate("task", new WorkflowTaskOperationRequest("copy", List.of("recipient"), "请知悉", null));
    verify(tasks, never()).setAssignee(anyString(), anyString());
    verify(tasks, never()).complete(anyString());
    verify(notifications).notifyTenantUsers(eq("t"), eq(List.of("recipient")), eq("审批事项抄送"), anyString());
  }
  @Test void refusesRecipientWithoutDataScope() {
    when(scopes.userDataScope("t", "recipient")).thenReturn(DataScope.departments(List.of("another")));
    assertThrows(PermissionDeniedException.class, () -> service.operate("task",
        new WorkflowTaskOperationRequest("transfer", List.of("recipient"), "转交", null)));
    verify(tasks, never()).setAssignee(anyString(), anyString());
  }
  @Test void refusesCrossTenantOrInactiveRecipient() {
    when(users.findByTenantAndId("t", "recipient")).thenReturn(null);
    assertThrows(PermissionDeniedException.class, () -> service.operate("task",
        new WorkflowTaskOperationRequest("transfer", List.of("recipient"), "转交", null)));
  }
  @Test void refusesPastDeadline() {
    assertThrows(IllegalArgumentException.class, () -> service.operate("task",
        new WorkflowTaskOperationRequest("deadline", List.of(), "办理时限", OffsetDateTime.now().minusHours(1))));
    verify(tasks, never()).setDueDate(anyString(), any());
  }
  @Test void persistsFutureDeadline() {
    service.operate("task", new WorkflowTaskOperationRequest("deadline", List.of(), "办理时限", OffsetDateTime.now().plusDays(2)));
    verify(tasks).setDueDate(eq("task"), any());
  }
  @Test void noTaskAuthorityMeansNoOperation() {
    when(workflows.requireCurrentUserTask("task")).thenThrow(new PermissionDeniedException("无权办理"));
    assertThrows(PermissionDeniedException.class, () -> service.operate("task",
        new WorkflowTaskOperationRequest("copy", List.of("recipient"), "请知悉", null)));
    verifyNoInteractions(notifications, events);
  }
  @Test void refusesUnsupportedAction() {
    assertThrows(IllegalArgumentException.class, () -> service.operate("task",
        new WorkflowTaskOperationRequest("approve", List.of(), "不能绕过节点表单", null)));
  }
}
