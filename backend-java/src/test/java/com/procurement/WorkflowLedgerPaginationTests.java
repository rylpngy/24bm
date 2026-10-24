package com.procurement;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.procurement.common.tenant.TenantContext;
import com.procurement.identity.application.*;
import com.procurement.identity.domain.DataScope;
import com.procurement.identity.infrastructure.BuyerUserMapper;
import com.procurement.workflow.application.UnifiedWorkflowApplicationService;
import com.procurement.workflow.api.UnifiedWorkflowTaskResponse;
import com.procurement.workflow.domain.*;
import com.procurement.workflow.infrastructure.WorkflowBusinessInstanceMapper;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.*;

class WorkflowLedgerPaginationTests {
  final WorkflowBusinessInstanceMapper mapper = mock(WorkflowBusinessInstanceMapper.class);
  final PermissionService permissions = mock(PermissionService.class);
  final DataScopeService scope = mock(DataScopeService.class);
  final UnifiedWorkflowApplicationService service = spy(new UnifiedWorkflowApplicationService(
      null, mapper, null, null, null, null, null, mock(BuyerUserMapper.class), null, permissions, scope, null, null, null, List.of()));

  @BeforeEach void setup() {
    TenantContext.set("tenant", null, "user");
    when(scope.currentUserDataScope()).thenReturn(DataScope.departments(List.of("dept")));
  }
  @AfterEach void clear() { TenantContext.clear(); }

  @Test void pagesBeyondTwoHundredWithScopeAndSearchBeforeCount() {
    var query = new WorkflowLedgerQuery("tenant", "all", "user", true, List.of("dept"), null, "%_literal");
    when(mapper.countLedger(query)).thenReturn(241L);
    when(mapper.pageLedger(query, 20, 200)).thenReturn(List.of(instance("older")));
    var result = service.pageCurrentTenantInstances("all", 11, 20, "  %_literal  ");
    assertThat(result.total()).isEqualTo(241);
    assertThat(result.items()).extracting(i -> i.workflowInstanceId()).containsExactly("older");
    verify(permissions).require("buyer:workflow:read");
    verify(mapper, never()).listByTenant(any(), anyInt());
  }

  @Test void emptyLastPageRetainsTrueTotalAndUsesLongOffset() {
    when(mapper.countLedger(any())).thenReturn(241L);
    var result = service.pageCurrentTenantInstances("processed", Integer.MAX_VALUE, 100, "");
    assertThat(result.total()).isEqualTo(241);
    assertThat(result.items()).isEmpty();
    verify(mapper, never()).pageLedger(any(), anyInt(), anyLong());
    verify(permissions).require("buyer:workflow:review");
  }

  @Test void validatesPageSizeViewAndSearch() {
    assertThatThrownBy(() -> service.pageCurrentTenantInstances("all", 0, 20, "")).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> service.pageCurrentTenantInstances("all", 1, 101, "")).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> service.pageCurrentTenantInstances("all", 1, 20, "x".repeat(101))).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> service.pageCurrentTenantInstances("unknown", 1, 20, "")).isInstanceOf(IllegalArgumentException.class);
    verifyNoInteractions(mapper);
  }

  @Test void pendingDeduplicatesInstancesAndRetainsAuthorizedTask() {
    var task = new UnifiedWorkflowTaskResponse("authorized-task", "pending", "purchase_demand", "demand", "Review", "review",
        "user", List.of(), List.of(), null, "dept", OffsetDateTime.now());
    doReturn(List.of(task, task)).when(service).listCurrentUserTasks();
    when(mapper.findByTenantAndId("tenant", "pending")).thenReturn(instance("pending"));
    var result = service.pageCurrentTenantInstances("pending", 1, 20, "pending");
    assertThat(result.total()).isEqualTo(1);
    assertThat(result.items().getFirst().currentTask().taskId()).isEqualTo("authorized-task");
    assertThat(service.pageCurrentTenantInstances("pending", 2, 20, "").items()).isEmpty();
  }

  @Test void pendingHasNoTwoHundredItemCap() {
    var tasks = java.util.stream.IntStream.range(0, 245).mapToObj(index -> {
      String id = "pending-" + index;
      when(mapper.findByTenantAndId("tenant", id)).thenReturn(instance(id));
      return new UnifiedWorkflowTaskResponse("task-" + index, id, "purchase_demand", id, "Review", "review",
          "user", List.of(), List.of(), null, "dept", OffsetDateTime.now());
    }).toList();
    doReturn(tasks).when(service).listCurrentUserTasks();
    var result = service.pageCurrentTenantInstances("pending", 13, 20, "");
    assertThat(result.total()).isEqualTo(245);
    assertThat(result.items()).hasSize(5);
  }

  private WorkflowBusinessInstance instance(String id) {
    var now = OffsetDateTime.now();
    return new WorkflowBusinessInstance(id, "tenant", "purchase_demand", "demand", "version", "engine", "approved",
        "user", "dept", null, null, null, "user", now, now, now);
  }
}
