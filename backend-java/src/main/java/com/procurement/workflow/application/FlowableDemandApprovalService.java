package com.procurement.workflow.application;

import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.workflow.api.CompleteApprovalRequest;
import com.procurement.workflow.api.StartProcessResponse;
import com.procurement.workflow.api.WorkflowTaskResponse;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.flowable.engine.HistoryService;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.TaskService;
import org.flowable.engine.runtime.ProcessInstance;
import org.flowable.task.api.Task;
import org.springframework.stereotype.Service;

// Flowable 工作流引擎驱动的采购需求审批(替代固定审批模板的工作流引擎切片)。
@Service
public class FlowableDemandApprovalService {
  private static final String PROCESS_KEY = "purchaseDemandApproval";

  private final RuntimeService runtimeService;
  private final TaskService taskService;
  private final HistoryService historyService;

  public FlowableDemandApprovalService(
      RuntimeService runtimeService, TaskService taskService, HistoryService historyService) {
    this.runtimeService = runtimeService;
    this.taskService = taskService;
    this.historyService = historyService;
  }

  public StartProcessResponse start(String demandId) {
    String tenantId = TenantAccessGuard.requireTenantId("workflow APIs");
    Map<String, Object> variables = new HashMap<>();
    variables.put("demandId", demandId);
    variables.put("tenantId", tenantId);
    ProcessInstance instance =
        runtimeService.startProcessInstanceByKey(PROCESS_KEY, demandId, variables);
    return new StartProcessResponse(instance.getId(), demandId, instance.isEnded());
  }

  public List<WorkflowTaskResponse> listPendingTasks() {
    String tenantId = TenantAccessGuard.requireTenantId("workflow APIs");
    return taskService.createTaskQuery()
        .processDefinitionKey(PROCESS_KEY)
        .processVariableValueEquals("tenantId", tenantId)
        .active()
        .orderByTaskCreateTime().desc()
        .list()
        .stream()
        .map(this::toResponse)
        .toList();
  }

  public void complete(String taskId, CompleteApprovalRequest request) {
    String tenantId = TenantAccessGuard.requireTenantId("workflow APIs");
    Task task = taskService.createTaskQuery()
        .taskId(taskId)
        .processVariableValueEquals("tenantId", tenantId)
        .active()
        .singleResult();
    if (task == null) {
      throw new IllegalArgumentException("Workflow task not found in tenant scope: " + taskId);
    }
    Map<String, Object> variables = new HashMap<>();
    variables.put("approved", Boolean.TRUE.equals(request.approved()));
    variables.put("reviewComment", request.comment() == null ? "" : request.comment());
    taskService.complete(taskId, variables);
  }

  // 历史流程的最终结果(已通过/已驳回/进行中)。
  public String outcome(String demandId) {
    var historic = historyService.createHistoricProcessInstanceQuery()
        .processInstanceBusinessKey(demandId)
        .processDefinitionKey(PROCESS_KEY)
        .singleResult();
    if (historic == null) {
      return "未启动";
    }
    if (historic.getEndTime() == null) {
      return "审批中";
    }
    return "endApproved".equals(historic.getEndActivityId()) ? "已通过" : "已驳回";
  }

  private WorkflowTaskResponse toResponse(Task task) {
    Object demandId = taskService.getVariable(task.getId(), "demandId");
    return new WorkflowTaskResponse(
        task.getId(),
        task.getName(),
        demandId == null ? null : demandId.toString(),
        task.getProcessInstanceId(),
        task.getCreateTime() == null ? null : task.getCreateTime().toString());
  }
}
