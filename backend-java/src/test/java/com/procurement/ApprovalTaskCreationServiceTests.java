package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.approval.application.ApprovalTaskApplicationService;
import com.procurement.approval.domain.ApprovalTask;
import com.procurement.approval.infrastructure.ApprovalTaskMapper;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.Test;

class ApprovalTaskCreationServiceTests {

  private final ApprovalTaskMapper approvalTaskMapper = org.mockito.Mockito.mock(ApprovalTaskMapper.class);
  private final ApprovalTaskApplicationService approvalTaskApplicationService =
      new ApprovalTaskApplicationService(approvalTaskMapper);

  @Test
  void createPendingTaskUsesUnifiedPendingStatusAndReturnsPersistedTask() {
    when(approvalTaskMapper.findByTenantAndId(
            org.mockito.ArgumentMatchers.eq("tenant-1"),
            org.mockito.ArgumentMatchers.anyString()))
        .thenAnswer(invocation -> task(invocation.getArgument(1)));

    ApprovalTask task = approvalTaskApplicationService.createPendingTask(
        "tenant-1",
        "purchase_demand",
        "demand-1",
        "approver-1");

    assertThat(task.status()).isEqualTo("待审批");
    verify(approvalTaskMapper).insert(
        org.mockito.ArgumentMatchers.<String>argThat(id -> id != null && id.startsWith("approval-")),
        org.mockito.ArgumentMatchers.eq("tenant-1"),
        org.mockito.ArgumentMatchers.eq("purchase_demand"),
        org.mockito.ArgumentMatchers.eq("demand-1"),
        org.mockito.ArgumentMatchers.eq("approver-1"),
        org.mockito.ArgumentMatchers.eq("待审批"));
  }

  private ApprovalTask task(String id) {
    return new ApprovalTask(
        id,
        "tenant-1",
        "purchase_demand",
        "demand-1",
        "approver-1",
        "待审批",
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"));
  }
}
