package com.procurement;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.procurement.common.tenant.TenantContext;
import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.identity.application.DataScopeService;
import com.procurement.identity.application.PermissionService;
import com.procurement.identity.domain.DataScope;
import com.procurement.supplier.application.SupplierExitItemsService;
import com.procurement.supplier.infrastructure.BuyerSupplierRelationMapper;
import com.procurement.supplier.infrastructure.SupplierExitItemsMapper;
import com.procurement.supplier.domain.BuyerSupplierRelation;
import java.util.List;
import org.junit.jupiter.api.*;

class SupplierExitItemsTests {
  final BuyerSupplierRelationMapper relations = mock(BuyerSupplierRelationMapper.class);
  final SupplierExitItemsMapper items = mock(SupplierExitItemsMapper.class);
  final PermissionService permissions = mock(PermissionService.class);
  final DataScopeService scopes = mock(DataScopeService.class);
  final SupplierExitItemsService service = new SupplierExitItemsService(relations,items,permissions,scopes);
  @BeforeEach void setup() {
    TenantContext.set("tenant",null,"user");
    when(relations.findByTenantAndId("tenant","rel")).thenReturn(new BuyerSupplierRelation(
        "rel","tenant","supplier","供应商","已准入","B","[]",null,null,null,
        null,null,null,null,null,null,null,null));
    when(scopes.currentUserDataScope()).thenReturn(DataScope.self("user"));
  }
  @AfterEach void clear() { TenantContext.clear(); }

  @Test void requiresBothPermissionsForEachKind() {
    for (String kind : List.of("uninvoiced","payment-verification")) {
      String permission = kind.equals("uninvoiced") ? "buyer:order:read" : "buyer:invoice:read";
      doThrow(new PermissionDeniedException("缺少权限")).when(permissions).require(permission);
      assertThatThrownBy(() -> service.list("rel",kind,1,10)).isInstanceOf(PermissionDeniedException.class);
      verify(permissions,atLeastOnce()).require("buyer:supplier:read");
      reset(permissions);
    }
    doThrow(new PermissionDeniedException("缺少权限")).when(permissions).require("buyer:supplier:read");
    assertThatThrownBy(() -> service.list("rel","uninvoiced",1,10)).isInstanceOf(PermissionDeniedException.class);
    verifyNoInteractions(items);
  }
  @Test void rejectsInvalidKindAndPaginationBeforeQuerying() {
    for (String kind : new String[]{null,"","all","UNINVOICED"}) {
      assertThatThrownBy(() -> service.list("rel",kind,1,10)).isInstanceOf(IllegalArgumentException.class);
    }
    assertThatThrownBy(() -> service.list("rel","uninvoiced",0,10)).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> service.list("rel","uninvoiced",-1,10)).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> service.list("rel","uninvoiced",1,0)).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> service.list("rel","uninvoiced",1,101)).isInstanceOf(IllegalArgumentException.class);
    verifyNoInteractions(items);
  }
  @Test void validatesTenantRelationBeforeReadingItems() {
    assertThatThrownBy(() -> service.list("foreign","uninvoiced",1,10)).isInstanceOf(IllegalArgumentException.class);
    verifyNoInteractions(items);
  }
  @Test void rejectsSupplierContext() {
    TenantContext.set(null,"supplier","user");
    assertThatThrownBy(() -> service.list("rel","uninvoiced",1,10)).isInstanceOf(IllegalStateException.class);
    verifyNoInteractions(items,relations);
  }

  @Test void httpUsesEnvelopeDefaultsAndRejectsUnparseablePagination() throws Exception {
    var application = mock(SupplierExitItemsService.class);
    when(application.list("rel","uninvoiced",1,10)).thenReturn(
        new com.procurement.supplier.api.SupplierExitItemsPage(List.of(),0,1,10));
    var mvc = org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup(
        new com.procurement.supplier.api.SupplierExitItemsController(application)).build();
    mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
        .get("/api/v1/buyer/suppliers/rel/exit-items").param("kind","uninvoiced"))
        .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk())
        .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.success").value(true))
        .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.data.page").value(1))
        .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.data.pageSize").value(10))
        .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.data.items").isEmpty());
    mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
        .get("/api/v1/buyer/suppliers/rel/exit-items").param("kind","uninvoiced").param("page","oops"))
        .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isBadRequest());
    mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
        .get("/api/v1/buyer/suppliers/rel/exit-items"))
        .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isBadRequest());
    verify(application).list("rel","uninvoiced",1,10);
    verifyNoMoreInteractions(application);
  }
  @Test void passesScopeToCountAndPageAndUsesLongOffset() {
    var scope = DataScope.self("user");
    when(items.count("tenant","supplier","uninvoiced",scope)).thenReturn(21L);
    when(items.list("tenant","supplier","uninvoiced",scope,10,10L)).thenReturn(List.of());
    var page = service.list("rel","uninvoiced",2,10);
    assertThat(page.total()).isEqualTo(21);
    assertThat(page.page()).isEqualTo(2);
    assertThat(page.pageSize()).isEqualTo(10);
    verify(items).list("tenant","supplier","uninvoiced",scope,10,10L);
    service.list("rel","uninvoiced",Integer.MAX_VALUE,100);
    verify(items).list("tenant","supplier","uninvoiced",scope,100,214748364600L);
  }
}
