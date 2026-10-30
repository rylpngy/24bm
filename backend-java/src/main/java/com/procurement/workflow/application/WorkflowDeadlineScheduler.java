package com.procurement.workflow.application;

import org.flowable.engine.TaskService;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(name="app.workflow.deadlines.enabled", havingValue="true")
public record WorkflowDeadlineScheduler(TaskService tasks, UnifiedWorkflowApplicationService workflows) {
  @Scheduled(fixedDelayString="${app.workflow.deadlines.interval-ms:60000}")
  public void sweep() {
    // Each task is rechecked under its business-instance lock before notifying.
    var query = tasks.createTaskQuery().active().taskCategory("24bid-workflow")
        .taskDueBefore(new java.util.Date()).orderByTaskCreateTime().asc();
    for (int offset = 0; ; offset += 200) {
      var overdue = query.listPage(offset, 200);
      for (var task : overdue) {
        try { workflows.remindOverdueTask(task.getId()); }
        catch (RuntimeException exception) { LoggerFactory.getLogger(WorkflowDeadlineScheduler.class)
            .warn("Deadline notification deferred for task {}: {}", task.getId(), exception.getClass().getSimpleName()); }
      }
      if (overdue.size() < 200) break;
    }
  }
}
