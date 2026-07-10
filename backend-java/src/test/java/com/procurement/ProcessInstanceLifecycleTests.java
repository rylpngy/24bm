package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.approval.application.ApprovalTaskApplicationService;
import com.procurement.approval.domain.ApprovalTask;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.process.api.ReviewProcessInstanceRequest;
import com.procurement.process.api.StartProcessInstanceRequest;
import com.procurement.process.application.ProcessInstanceApplicationService;
import com.procurement.process.domain.ProcessDefinition;
import com.procurement.process.domain.ProcessInstance;
import com.procurement.process.infrastructure.ProcessDefinitionMapper;
import com.procurement.process.infrastructure.ProcessInstanceMapper;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

// 流程实例:发起按表单解析审批路径 + 建任务;审批推进/驳回 + 推进任务。
class ProcessInstanceLifecycleTests {

  private final ProcessInstanceMapper instanceMapper = mock(ProcessInstanceMapper.class);
  private final ProcessDefinitionMapper defMapper = mock(ProcessDefinitionMapper.class);
  private final ApprovalTaskApplicationService approvalTasks = mock(ApprovalTaskApplicationService.class);
  private final AuditLogApplicationService audit = mock(AuditLogApplicationService.class);
  private final ProcessInstanceApplicationService service =
      new ProcessInstanceApplicationService(instanceMapper, defMapper, approvalTasks, audit);

  // 部门主管(approver) → 条件: 金额<5000 自动通过 / ≥5000 财务总监(approver)。
  private static final String FLOW = "{\"steps\":["
      + "{\"id\":\"s1\",\"type\":\"approver\",\"title\":\"部门主管\",\"assignee\":\"直接主管\"},"
      + "{\"id\":\"s2\",\"type\":\"condition\",\"branches\":["
      + "{\"condition\":{\"field\":\"f2\",\"op\":\"<\",\"value\":5000},\"steps\":[{\"id\":\"b1\",\"type\":\"auto\",\"title\":\"系统自动通过\"}]},"
      + "{\"condition\":{\"field\":\"f2\",\"op\":\">=\",\"value\":5000},\"steps\":[{\"id\":\"b2\",\"type\":\"approver\",\"title\":\"财务总监\",\"assignee\":\"王总\"}]}"
      + "]}]}";

  @AfterEach
  void clear() {
    TenantContext.clear();
  }

  private ProcessDefinition def() {
    return new ProcessDefinition("proc-1", "tenant-1", "采购立项审批", "", "box", "enabled",
        "{\"fields\":[]}", FLOW, OffsetDateTime.parse("2026-06-20T10:00:00+08:00"));
  }

  private ProcessInstance instance(String resolvedPath, int idx, String status) {
    return new ProcessInstance("pi-1", "tenant-1", "proc-1", "采购立项审批", new BigDecimal("8000"),
        "{\"f2\":\"8000\"}", resolvedPath, idx, status, "user-1",
        OffsetDateTime.parse("2026-06-29T10:00:00+08:00"), OffsetDateTime.parse("2026-06-29T10:00:00+08:00"));
  }

  @Test
  void startWithHighAmountResolvesTwoApproversAndCreatesFirstTask() {
    TenantContext.set("tenant-1", null, "user-1");
    when(defMapper.findByTenantAndId("tenant-1", "proc-1")).thenReturn(def());
    when(instanceMapper.findByTenantAndId(eq("tenant-1"), any()))
        .thenReturn(instance("[]", 0, "processing"));

    service.start(new StartProcessInstanceRequest("proc-1", "{\"f2\":\"8000\"}", new BigDecimal("8000")));

    // 8000 ≥ 5000 → 路径含 部门主管 + 财务总监(2 审批节点);建首个任务,状态 processing。
    verify(instanceMapper).insert(any(), eq("tenant-1"), eq("proc-1"), eq("采购立项审批"),
        eq(new BigDecimal("8000")), any(),
        org.mockito.ArgumentMatchers.contains("财务总监"), eq(0), eq("processing"), eq("user-1"));
    verify(approvalTasks).createGenericPendingTask(
        eq("tenant-1"), eq("process_instance"),
        org.mockito.ArgumentMatchers.startsWith("pi-"), org.mockito.ArgumentMatchers.isNull());
  }

  @Test
  void startWithLowAmountHasOneApproverThenAutoPass() {
    TenantContext.set("tenant-1", null, "user-1");
    when(defMapper.findByTenantAndId("tenant-1", "proc-1")).thenReturn(def());
    when(instanceMapper.findByTenantAndId(eq("tenant-1"), any()))
        .thenReturn(instance("[]", 0, "processing"));

    service.start(new StartProcessInstanceRequest("proc-1", "{\"f2\":\"3000\"}", new BigDecimal("3000")));

    // 3000 < 5000 → 部门主管 + 系统自动通过(1 审批节点)。
    verify(instanceMapper).insert(any(), any(), any(), any(), any(), any(),
        org.mockito.ArgumentMatchers.contains("系统自动通过"), anyInt(), eq("processing"), any());
  }

  @Test
  void approveAdvancesToNextApproverThenCompletes() {
    TenantContext.set("tenant-1", null, "user-1");
    String twoApprovers = "[{\"type\":\"approver\",\"title\":\"部门主管\"},{\"type\":\"approver\",\"title\":\"财务总监\"}]";
    when(instanceMapper.findByTenantAndId("tenant-1", "pi-1")).thenReturn(instance(twoApprovers, 0, "processing"));
    when(approvalTasks.findPendingTask("tenant-1", "process_instance", "pi-1"))
        .thenReturn(new ApprovalTask("approval-1", "tenant-1", "process_instance", "pi-1", null, "待审批", null, null));

    service.review("pi-1", new ReviewProcessInstanceRequest("approve", "同意"));

    verify(approvalTasks).completeTask("tenant-1", "approval-1", "已通过", "同意");
    // 还有第二个审批节点 → 推进到 index 1 + 建下一个任务,仍 processing。
    verify(instanceMapper).updateProgress("tenant-1", "pi-1", 1, "processing");
    verify(approvalTasks, org.mockito.Mockito.times(1)).createGenericPendingTask("tenant-1", "process_instance", "pi-1", null);
  }

  @Test
  void rejectMarksInstanceRejected() {
    TenantContext.set("tenant-1", null, "user-1");
    String oneApprover = "[{\"type\":\"approver\",\"title\":\"部门主管\"}]";
    when(instanceMapper.findByTenantAndId("tenant-1", "pi-1")).thenReturn(instance(oneApprover, 0, "processing"));
    when(approvalTasks.findPendingTask("tenant-1", "process_instance", "pi-1"))
        .thenReturn(new ApprovalTask("approval-1", "tenant-1", "process_instance", "pi-1", null, "待审批", null, null));

    service.review("pi-1", new ReviewProcessInstanceRequest("reject", "不同意"));

    verify(approvalTasks).completeTask("tenant-1", "approval-1", "已驳回", "不同意");
    verify(instanceMapper).updateProgress("tenant-1", "pi-1", 0, "rejected");
    verify(approvalTasks, never()).createGenericPendingTask(any(), any(), any(), any());
  }
}
