package com.procurement;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.ai.application.*;
import com.procurement.ai.api.AiReviewDtos.CreatePolicy;
import com.procurement.ai.infrastructure.AiPolicyMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.ai.AiContracts.Clause;
import com.procurement.common.tenant.TenantContext;
import com.procurement.identity.application.PermissionService;
import java.util.List;
import org.junit.jupiter.api.*;

class AiPolicyManagementTests {
  AiPolicyMapper mapper=mock(AiPolicyMapper.class);
  PermissionService permissions=mock(PermissionService.class);
  AuditLogApplicationService audit=mock(AuditLogApplicationService.class);
  AiPolicyApplicationService service=new AiPolicyApplicationService(mapper,permissions,audit,new ObjectMapper().findAndRegisterModules());
  @BeforeEach void context() { TenantContext.set("t1",null,"u1"); }
  @AfterEach void cleanup() { TenantContext.clear(); }
  @Test void delegatedPolicyAdministratorDoesNotNeedOrganizationRoleManagement() {
    when(mapper.list("t1")).thenReturn(List.of()); service.list();
    verify(permissions).require("buyer:ai:manage"); verify(permissions,never()).require("buyer:role:manage");
  }
  @Test void staleVersionCannotCreateNewPolicyOrAuditSuccess() {
    when(mapper.latest("t1","policy")).thenReturn(2);
    assertThatThrownBy(() -> service.create(request(1,List.of(new Clause("c1","Title","Text")))))
        .isInstanceOf(AiConflictException.class);
    verify(mapper,never()).insert(any(),any(),any(),anyInt(),any(),any(),any(),any()); verifyNoInteractions(audit);
  }
  @Test void emptyOrDuplicateClausesCannotBePublishedAsPolicyEvidence() {
    assertThatThrownBy(() -> service.create(request(0,List.of(new Clause("c1","Title","")))))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> service.create(request(0,List.of(new Clause("c1","Title","Text"),new Clause("c1","Other","Text")))))
        .isInstanceOf(IllegalArgumentException.class);
    verifyNoInteractions(mapper);
  }
  private CreatePolicy request(int latest,List<Clause> clauses) { return new CreatePolicy("policy","Policy",List.of("demand"),clauses,latest); }
}
