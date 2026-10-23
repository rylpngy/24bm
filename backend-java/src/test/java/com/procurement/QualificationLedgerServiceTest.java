package com.procurement;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.procurement.common.tenant.TenantContext;
import com.procurement.identity.application.PermissionService;
import com.procurement.supplier.application.QualificationLedgerService;
import com.procurement.supplier.infrastructure.QualificationLedgerMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class QualificationLedgerServiceTest {
  final QualificationLedgerMapper mapper = mock(QualificationLedgerMapper.class);
  final PermissionService permissions = mock(PermissionService.class);
  final QualificationLedgerService service = new QualificationLedgerService(mapper, permissions);
  @AfterEach void clear() { TenantContext.clear(); }
  @Test void deniedUserDoesNotReadLedger() {
    doThrow(new IllegalStateException("denied")).when(permissions).require("buyer:supplier:read");
    assertThatThrownBy(() -> service.list(null, "all", 1, 8)).hasMessage("denied");
    verifyNoInteractions(mapper);
  }
  @Test void rejectsInvalidFiltersAndPagination() {
    TenantContext.set("tenant", null, "user");
    assertThatThrownBy(() -> service.list(null, "bad", 1, 8)).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> service.list(null, "all", 0, 8)).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> service.list(null, "all", 1, 101)).isInstanceOf(IllegalArgumentException.class);
    verifyNoInteractions(mapper);
  }
  @Test void scopesToCurrentTenantAndClampsPage() {
    TenantContext.set("tenant", null, "user");
    when(mapper.count(eq("tenant"), eq("supplier"), eq("all"), any(), any())).thenReturn(9L);
    var result = service.list(" supplier ", "all", 100, 8);
    assertThat(result.page()).isEqualTo(2);
    assertThat(result.total()).isEqualTo(9);
    verify(mapper).list(eq("tenant"), eq("supplier"), eq("all"), any(), any(), eq(8), eq(8L));
  }
}
