package com.procurement.workflow.application;

import com.procurement.common.tenant.TenantAccessGuard;
import com.procurement.workflow.api.CompleteApprovalRequest;
import com.procurement.workflow.api.StartProcessResponse;
import com.procurement.workflow.api.WorkflowTaskResponse;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.flowable.engine.HistoryService;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.TaskService;
import org.flowable.engine.runtime.ProcessInstance;
import org.flowable.task.api.Task;
import org.springframework.stereotype.Service;

// Flowable 通用业务审批:接管全部审批类型(需求/定标/合同/付款),按金额阈值二级会签。
@Service
public class FlowableDemandApprovalService {
  private static final String PROCESS_KEY = "businessApproval";
  // 二级会签阈值:金额达到此值需高管复核(¥10 万)。
  private static final BigDecimal SECOND_LEVEL_THRESHOLD = new BigDecimal("100000");

  private final RuntimeService runtimeService;
  private final TaskService taskService;
  private final HistoryService historyService;

  public FlowableDemandApprovalService(
      RuntimeService runtimeService, TaskService taskService, HistoryService historyService) {
    this.runtimeService = runtimeService;
    this.taskService = taskService;
    this.historyService = historyService;
  }

  public StartProcessResponse start(String bizType, String bizId, BigDecimal amount) {
    String tenantId = TenantAccessGuard.requireTenantId("workflow APIs");
    BigDecimal effectiveAmount = amount == null ? BigDecimal.ZERO : amount;
    Map<String, Object> variables = new HashMap<>();
    variables.put("bizType", bizType == null ? "purchase_demand" : bizType);
    variables.put("bizId", bizId);
    variables.put("tenantId", tenantId);
    variables.put("amount", effectiveAmount);
    variables.put("threshold", SECOND_LEVEL_THRESHOLD);
    ProcessInstance instance =
        runtimeService.startProcessInstanceByKey(PROCESS_KEY, bizId, variables);
    return new StartProcessResponse(
        instance.getId(),
        bizType == null ? "purchase_demand" : bizType,
        bizId,
        instance.isEnded());
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

  // 历史流程最终结果(已通过/已驳回/审批中/未启动)。
  public String outcome(String bizId) {
    var historic = historyService.createHistoricProcessInstanceQuery()
        .processInstanceBusinessKey(bizId)
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
    Map<String, Object> vars = taskService.getVariables(task.getId());
    Object amount = vars.get("amount");
    return new WorkflowTaskResponse(
        task.getId(),
        task.getName(),
        vars.get("bizType") == null ? null : vars.get("bizType").toString(),
        vars.get("bizId") == null ? null : vars.get("bizId").toString(),
        amount instanceof BigDecimal bd ? bd : (amount == null ? null : new BigDecimal(amount.toString())),
        task.getProcessInstanceId(),
        task.getCreateTime() == null ? null : task.getCreateTime().toString());
  }
}
