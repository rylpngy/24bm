package com.procurement;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.common.tenant.TenantContext;
import com.procurement.workflow.application.*;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import com.procurement.workflow.infrastructure.*;
import java.math.BigDecimal;
import java.util.List;
import org.flowable.engine.RuntimeService;
import org.flowable.engine.TaskService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class PurchaseDemandWithdrawalTests {
  private WorkflowBusinessInstance instance = instance("processing", "purchase_demand", "requester");
  private final WorkflowBusinessInstanceMapper instances = mock(WorkflowBusinessInstanceMapper.class, call -> {
    if (call.getMethod().getName().equals("findByTenantAndIdForUpdate")) return instance;
    if (call.getMethod().getName().equals("complete")) return 1;
    return org.mockito.Answers.RETURNS_DEFAULTS.answer(call);
  });
  private final RuntimeService runtime = mock(RuntimeService.class);
  private final TaskService tasks = mock(TaskService.class, RETURNS_DEEP_STUBS);
  private final WorkflowTaskEventMapper events = mock(WorkflowTaskEventMapper.class);
  private final WorkflowBusinessCompletionHandler handler = mock(WorkflowBusinessCompletionHandler.class);
  private final UnifiedWorkflowApplicationService service = new UnifiedWorkflowApplicationService(
      null, instances, events, null, null, runtime, tasks, null, null,
      mock(com.procurement.identity.application.PermissionService.class), TestDataScopes.unrestricted(),
      mock(com.procurement.audit.application.AuditLogApplicationService.class), null, null, List.of(handler));

  private void withdraw(String reason) throws Throwable {
    service.withdrawPurchaseDemand("wf-1", reason);
  }

  @AfterEach void clear() { TenantContext.clear(); }

  @Test void initiatorWithdrawalReallyDeletesFlowableRuntimeAndRecordsReason() {
    TenantContext.set("tenant-1", null, "requester");
    when(handler.businessType()).thenReturn("purchase_demand");
    assertThatCode(() -> withdraw("数量需修正")).doesNotThrowAnyException();
    verify(runtime).deleteProcessInstance("flow-1", "数量需修正");
    verify(instances).complete("tenant-1", "wf-1", "cancelled", "requester");
    verify(handler).onCancelled(instance, "requester", "数量需修正");
    verify(events).insert(anyString(), eq("tenant-1"), eq("wf-1"), isNull(), isNull(), isNull(),
        eq("cancelled"), eq("requester"), eq("数量需修正"));
  }

  @Test void evenAnUnrestrictedUserCannotWithdrawAnotherInitiatorsInstance() {
    TenantContext.set("tenant-1", null, "other-user");
    assertThatThrownBy(() -> withdraw("代撤回")).isInstanceOf(PermissionDeniedException.class);
    verifyNoInteractions(runtime);
  }

  @Test void completedInstanceCannotBeWithdrawn() {
    TenantContext.set("tenant-1", null, "requester");
    instance = instance("approved", "purchase_demand", "requester");
    assertThatThrownBy(() -> withdraw("修改")).isInstanceOf(IllegalStateException.class);
    verifyNoInteractions(runtime);
  }

  @Test void otherBusinessTypesAreNotWithdrawable() {
    TenantContext.set("tenant-1", null, "requester");
    instance = instance("processing", "rfq_award", "requester");
    assertThatThrownBy(() -> withdraw("修改")).isInstanceOf(IllegalArgumentException.class);
    verifyNoInteractions(runtime);
  }

  @Test void withdrawalRequiresAReason() {
    TenantContext.set("tenant-1", null, "requester");
    assertThatThrownBy(() -> withdraw("  ")).isInstanceOf(IllegalArgumentException.class);
    verifyNoInteractions(runtime);
  }

  private static WorkflowBusinessInstance instance(String status, String type, String initiator) {
    return new WorkflowBusinessInstance("wf-1", "tenant-1", type, "demand-1", "version-1", "flow-1",
        status, initiator, "dept-it", BigDecimal.TEN, "{}", "{}", null, null, null, null);
  }
}
