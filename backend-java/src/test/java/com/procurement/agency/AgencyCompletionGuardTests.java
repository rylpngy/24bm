package com.procurement.agency;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.procurement.agency.application.*;
import com.procurement.agency.domain.AgencyRecords.PackageRow;
import com.procurement.agency.infrastructure.AgencyMapper;
import com.procurement.identity.application.PermissionService;
import org.junit.jupiter.api.Test;

class AgencyCompletionGuardTests {
  @Test
  void
      businessClosureBlocksNewExecutionButKeepsFinancialArchiveAndControlledPostFollowupAvailable() {
    var guard = mock(AgencyGuard.class);
    var mapper = mock(AgencyMapper.class);
    var permissions = mock(PermissionService.class);
    var p =
        new com.fasterxml.jackson.databind.ObjectMapper()
            .convertValue(
                java.util.Map.of("id", "p", "tenantId", "t", "businessStatus", "closed"),
                PackageRow.class);
    when(guard.tenant()).thenReturn("t");
    when(guard.permissions()).thenReturn(permissions);
    when(mapper.lock("t", "p")).thenReturn(p);
    var support =
        new AgencyExecutionSupport(guard, mapper, null, null, null, null, null, null, null);
    assertThatThrownBy(() -> support.write("p", "buyer:agency:evaluation:manage"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("业务已办结");
    assertThatThrownBy(() -> support.write("p", "buyer:agency:document:manage"))
        .isInstanceOf(IllegalStateException.class);
    for (var permission :
        java.util.List.of(
            "buyer:agency:finance:manage",
            "buyer:agency:archive:manage",
            "buyer:agency:post:manage")) assertThat(support.write("p", permission)).isSameAs(p);
  }
}
