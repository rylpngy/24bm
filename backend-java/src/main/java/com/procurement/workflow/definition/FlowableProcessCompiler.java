package com.procurement.workflow.definition;

import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.flowable.bpmn.converter.BpmnXMLConverter;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.EndEvent;
import org.flowable.bpmn.model.ExclusiveGateway;
import org.flowable.bpmn.model.FlowNode;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.SequenceFlow;
import org.flowable.bpmn.model.StartEvent;
import org.flowable.bpmn.model.UserTask;
import org.springframework.stereotype.Component;

// 从已校验的结构化流程生成 BPMN。条件表达式由受控字段与操作符拼装，不接收任意表达式文本。
@Component
public class FlowableProcessCompiler {

  public CompiledWorkflowBpmn compile(
      String processDefinitionId,
      String businessType,
      int versionNo,
      String processName,
      WorkflowDefinitionSchema schema,
      String tenantId) {
    String processKey = processKey(processDefinitionId, businessType, versionNo);
    BpmnModel model = new BpmnModel();
    Process process = new Process();
    process.setId(processKey);
    process.setName(processName);
    process.setExecutable(true);
    model.addProcess(process);

    StartEvent start = node(new StartEvent(), "start", "发起审批");
    EndEvent approved = node(new EndEvent(), "end_approved", "审批通过");
    EndEvent rejected = node(new EndEvent(), "end_rejected", "审批驳回");
    process.addFlowElement(start);
    process.addFlowElement(approved);
    process.addFlowElement(rejected);

    CompileContext context = new CompileContext(process, tenantId, rejected);
    FlowNode first = compileSteps(schema.steps(), approved, context);
    connect(process, start, first, null, context);
    return new CompiledWorkflowBpmn(processKey, new BpmnXMLConverter().convertToXML(model));
  }

  private FlowNode compileSteps(
      List<WorkflowDefinitionSchema.FlowStep> steps,
      FlowNode terminal,
      CompileContext context) {
    FlowNode next = terminal;
    for (int index = steps.size() - 1; index >= 0; index--) {
      WorkflowDefinitionSchema.FlowStep step = steps.get(index);
      if ("auto".equals(step.type())) {
        continue;
      }
      if ("approver".equals(step.type())) {
        next = compileApprover(step, next, context);
      } else if ("condition".equals(step.type())) {
        next = compileCondition(step, next, context);
      }
    }
    return next;
  }

  private FlowNode compileApprover(
      WorkflowDefinitionSchema.FlowStep step,
      FlowNode approvedTarget,
      CompileContext context) {
    UserTask task = node(new UserTask(), "task_" + step.id(), step.title());
    task.setCategory("24bid-workflow");
    switch (step.assignment().type()) {
      case "user" -> task.setCandidateUsers(List.of(step.assignment().userId()));
      case "role" -> task.setCandidateGroups(List.of(candidateRoleGroup(context.tenantId(), step.assignment().roleId())));
      case "initiator_department_manager" -> task.setAssignee("${assignee_" + step.id() + "}");
      default -> throw new IllegalStateException("Unexpected validated workflow assignment");
    }
    ExclusiveGateway decision = node(new ExclusiveGateway(), "decision_" + step.id(), "审批结果");
    context.process().addFlowElement(task);
    context.process().addFlowElement(decision);
    connect(context.process(), task, decision, null, context);
    connect(context.process(), decision, approvedTarget, "${approved == true}", context);
    SequenceFlow rejected = connect(context.process(), decision, context.rejectedEnd(), null, context);
    decision.setDefaultFlow(rejected.getId());
    return task;
  }

  private FlowNode compileCondition(
      WorkflowDefinitionSchema.FlowStep step,
      FlowNode next,
      CompileContext context) {
    ExclusiveGateway split = node(new ExclusiveGateway(), "condition_" + step.id(), "条件分支");
    ExclusiveGateway join = node(new ExclusiveGateway(), "join_" + step.id(), "分支汇合");
    context.process().addFlowElement(split);
    context.process().addFlowElement(join);
    connect(context.process(), join, next, null, context);
    for (WorkflowDefinitionSchema.FlowBranch branch : step.branches()) {
      FlowNode branchStart = compileSteps(branch.steps(), join, context);
      SequenceFlow flow = connect(
          context.process(),
          split,
          branchStart,
          branch.condition() == null ? null : conditionExpression(branch.condition()),
          context);
      if (branch.condition() == null) {
        split.setDefaultFlow(flow.getId());
      }
    }
    return split;
  }

  private static String conditionExpression(WorkflowDefinitionSchema.Condition condition) {
    String variable = switch (condition.field()) {
      case "$amount" -> "amount";
      case "$departmentId" -> "departmentId";
      default -> "form_" + condition.field();
    };
    if (condition.numeric()) {
      return "${" + variable + " " + condition.operator() + " "
          + condition.numericValue().toPlainString() + "}";
    }
    String safeValue = condition.value().replace("\\", "\\\\").replace("'", "\\'");
    return "${" + variable + " " + condition.operator() + " '" + safeValue + "'}";
  }

  private static String candidateRoleGroup(String tenantId, String roleId) {
    return "role:" + tenantId + ":" + roleId;
  }

  public static String roleGroup(String tenantId, String roleId) {
    return candidateRoleGroup(tenantId, roleId);
  }

  private static String processKey(String processDefinitionId, String businessType, int versionNo) {
    String safeId = processDefinitionId.replaceAll("[^A-Za-z0-9_]", "_");
    String safeBusinessType = businessType.replaceAll("[^A-Za-z0-9_]", "_");
    return "wf_" + safeBusinessType + "_v" + versionNo + "_" + safeId;
  }

  private static <T extends FlowNode> T node(T node, String id, String name) {
    node.setId(id);
    node.setName(name);
    return node;
  }

  private static SequenceFlow connect(
      Process process,
      FlowNode source,
      FlowNode target,
      String condition,
      CompileContext context) {
    SequenceFlow flow = new SequenceFlow(source.getId(), target.getId());
    flow.setId("flow_" + context.sequence().incrementAndGet());
    if (condition != null) {
      flow.setConditionExpression(condition);
    }
    process.addFlowElement(flow);
    return flow;
  }

  private record CompileContext(
      Process process,
      String tenantId,
      FlowNode rejectedEnd,
      AtomicInteger sequence) {
    private CompileContext(Process process, String tenantId, FlowNode rejectedEnd) {
      this(process, tenantId, rejectedEnd, new AtomicInteger());
    }
  }
}
