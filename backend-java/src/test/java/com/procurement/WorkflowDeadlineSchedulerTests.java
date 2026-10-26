package com.procurement;

import com.procurement.workflow.application.UnifiedWorkflowApplicationService;
import com.procurement.workflow.application.WorkflowDeadlineScheduler;
import org.flowable.engine.TaskService;
import org.flowable.task.api.Task;
import org.flowable.task.api.TaskQuery;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.mockito.Mockito.*;

class WorkflowDeadlineSchedulerTests {
  private final TaskService tasks=mock(TaskService.class);
  private final TaskQuery query=mock(TaskQuery.class,RETURNS_SELF);
  private final UnifiedWorkflowApplicationService workflows=mock(UnifiedWorkflowApplicationService.class);

  @Test void scansBeyondTheFirstPage() {
    when(tasks.createTaskQuery()).thenReturn(query);
    Task first=mock(Task.class),second=mock(Task.class);
    when(first.getId()).thenReturn("first");when(second.getId()).thenReturn("second");
    when(query.listPage(0,200)).thenReturn(java.util.Collections.nCopies(200,first));
    when(query.listPage(200,200)).thenReturn(List.of(second));
    new WorkflowDeadlineScheduler(tasks,workflows).sweep();
    verify(workflows,times(200)).remindOverdueTask("first");
    verify(workflows).remindOverdueTask("second");
  }

  @Test void oneStaleTaskDoesNotPreventOtherNotifications() {
    when(tasks.createTaskQuery()).thenReturn(query);
    Task first=mock(Task.class),second=mock(Task.class);
    when(first.getId()).thenReturn("stale");when(second.getId()).thenReturn("valid");
    when(query.listPage(0,200)).thenReturn(List.of(first,second));
    doThrow(new IllegalStateException("stale")).when(workflows).remindOverdueTask("stale");
    new WorkflowDeadlineScheduler(tasks,workflows).sweep();
    verify(workflows).remindOverdueTask("valid");
  }
}
