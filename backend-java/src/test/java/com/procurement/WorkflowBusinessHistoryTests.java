package com.procurement;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.procurement.common.tenant.TenantContext;
import com.procurement.identity.application.*;
import com.procurement.identity.domain.DataScope;
import com.procurement.identity.infrastructure.BuyerUserMapper;
import com.procurement.workflow.application.UnifiedWorkflowApplicationService;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import com.procurement.workflow.infrastructure.WorkflowBusinessInstanceMapper;
import java.time.OffsetDateTime;
import java.util.List;
import org.junit.jupiter.api.*;

class WorkflowBusinessHistoryTests {
  final WorkflowBusinessInstanceMapper mapper = mock(WorkflowBusinessInstanceMapper.class);
  final PermissionService permissions = mock(PermissionService.class);
  final DataScopeService scope = mock(DataScopeService.class);
  final UnifiedWorkflowApplicationService service = new UnifiedWorkflowApplicationService(
      null, mapper, null, null, null, null, null, mock(BuyerUserMapper.class), null, permissions, scope, null, null, null, List.of());
  @BeforeEach void setup() { TenantContext.set("tenant", null, "user"); when(scope.currentUserDataScope()).thenReturn(DataScope.unrestricted()); }
  @AfterEach void clear() { TenantContext.clear(); }
  @Test void filtersBeforePaginationAndRetainsAllAttemptStatuses() {
    when(scope.currentUserDataScope()).thenReturn(DataScope.departments(List.of("visible")));
    when(mapper.listByBusiness("tenant", "buyer_supplier_admission", "relation", 5001))
        .thenReturn(List.of(instance("hidden", "other", "approved"), instance("second", "visible", "approved"), instance("first", "visible", "rejected")));
    var page = service.listCurrentTenantBusinessInstances("buyer_supplier_admission", "relation", 2, 1);
    assertThat(page.total()).isEqualTo(2); assertThat(page.items()).extracting(i -> i.workflowInstanceId()).containsExactly("first");
    verify(permissions).require("buyer:workflow:read");
  }
  @Test void validatesPaginationAndRequiresIdentityBeforeReading() {
    assertThatThrownBy(() -> service.listCurrentTenantBusinessInstances("buyer_supplier_admission", "relation", 0, 10)).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> service.listCurrentTenantBusinessInstances("buyer_supplier_admission", "relation", 1, 101)).isInstanceOf(IllegalArgumentException.class);
    TenantContext.clear();
    assertThatThrownBy(() -> service.listCurrentTenantBusinessInstances("buyer_supplier_admission", "relation", 1, 10)).isInstanceOf(IllegalStateException.class);
    verifyNoInteractions(mapper);
  }
  @Test void refusesTruncationAndDoesNotReturnOtherBusinessTypes() {
    when(mapper.listByBusiness("tenant", "buyer_supplier_admission", "relation", 5001))
        .thenReturn(java.util.Collections.nCopies(5001, instance("large", "visible", "cancelled")));
    assertThatThrownBy(() -> service.listCurrentTenantBusinessInstances("buyer_supplier_admission", "relation", 1, 10))
        .hasMessageContaining("5000");
    assertThatThrownBy(() -> service.listCurrentTenantBusinessInstances("unknown", "relation", 1, 10))
        .isInstanceOf(IllegalArgumentException.class);
  }
  private WorkflowBusinessInstance instance(String id, String department, String status) {
    var now = OffsetDateTime.now();
    return new WorkflowBusinessInstance(id, "tenant", "buyer_supplier_admission", "relation", "version", "engine", status,
        "user", department, null, "{}", "{}", "user", now, now, now);
  }
}
