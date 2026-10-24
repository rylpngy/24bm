package com.procurement;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.*;
import com.procurement.identity.application.PermissionService;
import com.procurement.supplier.application.SupplierInvitationApplicationService;
import com.procurement.supplier.api.*;
import com.procurement.supplier.domain.SupplierInvitation;
import com.procurement.supplier.infrastructure.*;
import java.util.List;
import org.junit.jupiter.api.*;

class SupplierInvitationApplicationServiceTests {
  final SupplierInvitationMapper invitations = mock(SupplierInvitationMapper.class);
  final BuyerSupplierRelationMapper relations = mock(BuyerSupplierRelationMapper.class);
  final PermissionService permissions = mock(PermissionService.class);
  final AuditLogApplicationService audit = mock(AuditLogApplicationService.class);
  final SupplierInvitationApplicationService service = new SupplierInvitationApplicationService(
      invitations,relations,new ObjectMapper(),permissions,audit);
  SupplierInvitation pending(String supplierId) {
    return new SupplierInvitation("inv","tenant",supplierId,"真实供应商",null,"设备","合作邀请","待回复",null,null,null,"采购企业");
  }
  @BeforeEach void setup() {
    TenantContext.set("tenant",null,"buyer");
    when(invitations.respond(anyString(),anyString(),anyString())).thenReturn(1);
    when(invitations.findByTenantAndId("tenant","inv")).thenReturn(pending("supplier"));
  }
  @AfterEach void clear() { TenantContext.clear(); }

  @Test void buyerCannotAcceptOrDeclineBoundSupplier() {
    when(invitations.lockByTenantAndId("tenant","inv")).thenReturn(pending("supplier"));
    for(String action : List.of("accept","decline")) {
      assertThatThrownBy(() -> service.respond("inv",new RespondSupplierInvitationRequest(action)))
          .isInstanceOf(IllegalArgumentException.class);
    }
    verify(invitations,never()).respond(any(),any(),any());
    verifyNoInteractions(relations,audit);
  }
  @Test void buyerCanWithdrawBoundInvitationAndAudit() {
    when(invitations.lockByTenantAndId("tenant","inv")).thenReturn(pending("supplier"));
    service.respond("inv",new RespondSupplierInvitationRequest("withdraw"));
    verify(invitations).respond("tenant","inv","已撤回");
    verify(audit).recordTenantAction(eq("tenant"),eq("supplier_invitation.withdraw"),eq("supplier_invitation"),eq("inv"),anyString());
    verifyNoInteractions(relations);
  }
  @Test void offlineAcceptanceNeverCreatesRelation() {
    when(invitations.lockByTenantAndId("tenant","inv")).thenReturn(pending(null));
    service.respond("inv",new RespondSupplierInvitationRequest("accept"));
    verify(invitations).respond("tenant","inv","已接受");
    verifyNoInteractions(relations);
  }
  @Test void supplierAcceptanceUsesLockedInvitationTenantAndInsertOnlyRelation() {
    TenantContext.set(null,"supplier","supplier-user");
    when(invitations.lockBySupplierAndId("supplier","inv")).thenReturn(pending("supplier"));
    service.respondSupplier("inv",new RespondSupplierInvitationRequest("accept"));
    verify(permissions).require("supplier:profile:manage");
    verify(invitations).respond("tenant","inv","已接受");
    verify(relations).insertIfAbsent(anyString(),eq("tenant"),eq("supplier"),eq("待准入"),eq("普通"),eq("[\"设备\"]"));
    verify(audit).recordTenantAction(eq("tenant"),eq("supplier_invitation.accept"),eq("supplier_invitation"),eq("inv"),anyString());
    verify(relations,never()).updateStatus(any(),any(),any(),any());
  }
  @Test void supplierCannotWithdrawOrRespondToForeignInvitation() {
    TenantContext.set(null,"supplier","supplier-user");
    assertThatThrownBy(() -> service.respondSupplier("inv",new RespondSupplierInvitationRequest("withdraw")))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> service.respondSupplier("foreign",new RespondSupplierInvitationRequest("accept")))
        .isInstanceOf(IllegalArgumentException.class);
    verify(invitations,never()).respond(any(),any(),any());
  }
  @Test void failedCompareAndSetCannotCreateRelationOrAudit() {
    TenantContext.set(null,"supplier","supplier-user");
    when(invitations.lockBySupplierAndId("supplier","inv")).thenReturn(pending("supplier"));
    when(invitations.respond("tenant","inv","已接受")).thenReturn(0);
    assertThatThrownBy(() -> service.respondSupplier("inv",new RespondSupplierInvitationRequest("accept")))
        .isInstanceOf(IllegalStateException.class);
    verifyNoInteractions(relations,audit);
  }
  @Test void supplierListRequiresReadAndReturnsBuyerName() {
    TenantContext.set(null,"supplier","supplier-user");
    when(invitations.listBySupplier("supplier")).thenReturn(List.of(pending("supplier")));
    assertThat(service.listSupplierInvitations().getFirst().buyerName()).isEqualTo("采购企业");
    verify(permissions).require("supplier:profile:read");
    doThrow(new PermissionDeniedException("无权查看")).when(permissions).require("supplier:profile:read");
    assertThatThrownBy(service::listSupplierInvitations).isInstanceOf(PermissionDeniedException.class);
    doThrow(new PermissionDeniedException("无权办理")).when(permissions).require("supplier:profile:manage");
    assertThatThrownBy(() -> service.respondSupplier("inv",new RespondSupplierInvitationRequest("accept")))
        .isInstanceOf(PermissionDeniedException.class);
  }
  @Test void createUsesPlatformSupplierNameAndRejectsNonSupplier() {
    when(invitations.findSupplierName("supplier")).thenReturn("真实供应商");
    when(invitations.findByTenantAndId(eq("tenant"),anyString())).thenReturn(pending("supplier"));
    service.createInvitation(new CreateSupplierInvitationRequest("supplier","伪造名称",null,null,null));
    verify(invitations).insert(anyString(),eq("tenant"),eq("supplier"),eq("真实供应商"),isNull(),isNull(),isNull(),eq("待回复"));
    assertThatThrownBy(() -> service.createInvitation(new CreateSupplierInvitationRequest("buyer-enterprise","伪造",null,null,null)))
        .isInstanceOf(IllegalArgumentException.class);
  }
  @Test void completedAndInvalidActionsAreRejected() {
    when(invitations.lockByTenantAndId("tenant","inv")).thenReturn(new SupplierInvitation(
        "inv","tenant",null,"供应商",null,null,null,"已接受",null,null,null,"采购企业"));
    assertThatThrownBy(() -> service.respond("inv",new RespondSupplierInvitationRequest("accept"))).isInstanceOf(IllegalStateException.class);
    assertThatThrownBy(() -> service.respond("inv",new RespondSupplierInvitationRequest("explode"))).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> service.respond("inv",new RespondSupplierInvitationRequest(null))).isInstanceOf(IllegalArgumentException.class);
  }
}
