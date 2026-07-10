package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.common.tenant.TenantContext;
import com.procurement.supplier.application.SupplierInvitationApplicationService;
import com.procurement.supplier.api.RespondSupplierInvitationRequest;
import com.procurement.supplier.api.SupplierInvitationResponse;
import com.procurement.supplier.domain.SupplierInvitation;
import com.procurement.supplier.infrastructure.BuyerSupplierRelationMapper;
import com.procurement.supplier.infrastructure.SupplierInvitationMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

// 邀请管理:状态机(仅待回复可处理)+ 接受桥接私域待准入(关联已知供应商且未在库)。
class SupplierInvitationApplicationServiceTests {

  private final SupplierInvitationMapper invitationMapper = mock(SupplierInvitationMapper.class);
  private final BuyerSupplierRelationMapper relationMapper = mock(BuyerSupplierRelationMapper.class);
  private final SupplierInvitationApplicationServiceHarness harness =
      new SupplierInvitationApplicationServiceHarness(invitationMapper, relationMapper);

  @AfterEach
  void clear() {
    TenantContext.clear();
  }

  private SupplierInvitation pending(String supplierId) {
    return new SupplierInvitation(
        "inv-1", "tenant-acme", supplierId, "远景智能装备有限公司",
        "zhang@yuanjing.com", "智能制造", "邀请补资料", "待回复", null, null, null);
  }

  @Test
  void acceptWithKnownSupplierBridgesToAdmission() {
    TenantContext.set("tenant-acme", null, "buyer-user");
    when(invitationMapper.findByTenantAndId("tenant-acme", "inv-1"))
        .thenReturn(pending("ent-supplier-newapply"));
    when(relationMapper.countByTenantSupplier("tenant-acme", "ent-supplier-newapply")).thenReturn(0);

    harness.service().respond("inv-1", new RespondSupplierInvitationRequest("accept"));

    verify(invitationMapper).respond("tenant-acme", "inv-1", "已接受");
    verify(relationMapper).insert(any(), eq("tenant-acme"), eq("ent-supplier-newapply"),
        eq("待准入"), eq("普通"), any());
  }

  @Test
  void acceptDoesNotDuplicateExistingRelation() {
    TenantContext.set("tenant-acme", null, "buyer-user");
    when(invitationMapper.findByTenantAndId("tenant-acme", "inv-1"))
        .thenReturn(pending("ent-supplier-newapply"));
    when(relationMapper.countByTenantSupplier("tenant-acme", "ent-supplier-newapply")).thenReturn(1);

    harness.service().respond("inv-1", new RespondSupplierInvitationRequest("accept"));

    verify(relationMapper, never()).insert(any(), any(), any(), any(), any(), any());
  }

  @Test
  void acceptExternalSupplierDoesNotBridge() {
    TenantContext.set("tenant-acme", null, "buyer-user");
    when(invitationMapper.findByTenantAndId("tenant-acme", "inv-1")).thenReturn(pending(null));

    harness.service().respond("inv-1", new RespondSupplierInvitationRequest("accept"));

    verify(invitationMapper).respond("tenant-acme", "inv-1", "已接受");
    verify(relationMapper, never()).insert(any(), any(), any(), any(), any(), any());
  }

  @Test
  void withdrawTransitionsWithoutBridging() {
    TenantContext.set("tenant-acme", null, "buyer-user");
    when(invitationMapper.findByTenantAndId("tenant-acme", "inv-1"))
        .thenReturn(pending("ent-supplier-newapply"));

    harness.service().respond("inv-1", new RespondSupplierInvitationRequest("withdraw"));

    verify(invitationMapper).respond("tenant-acme", "inv-1", "已撤回");
    verify(relationMapper, never()).insert(any(), any(), any(), any(), any(), any());
  }

  @Test
  void respondingToNonPendingInvitationIsRejected() {
    TenantContext.set("tenant-acme", null, "buyer-user");
    when(invitationMapper.findByTenantAndId("tenant-acme", "inv-1")).thenReturn(
        new SupplierInvitation("inv-1", "tenant-acme", null, "蓝海办公",
            null, null, null, "已接受", null, null, null));

    assertThatThrownBy(() ->
        harness.service().respond("inv-1", new RespondSupplierInvitationRequest("accept")))
        .isInstanceOf(IllegalStateException.class);
  }

  @Test
  void invalidActionIsRejected() {
    TenantContext.set("tenant-acme", null, "buyer-user");
    when(invitationMapper.findByTenantAndId("tenant-acme", "inv-1")).thenReturn(pending(null));

    assertThatThrownBy(() ->
        harness.service().respond("inv-1", new RespondSupplierInvitationRequest("explode")))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void mapsLinkedFlagFromSupplierId() {
    TenantContext.set("tenant-acme", null, "buyer-user");
    when(invitationMapper.listByTenant("tenant-acme")).thenReturn(java.util.List.of(
        pending("ent-supplier-newapply"),
        pending(null)));

    java.util.List<SupplierInvitationResponse> list = harness.service().listInvitations();

    assertThat(list.get(0).linkedToKnownSupplier()).isTrue();
    assertThat(list.get(1).linkedToKnownSupplier()).isFalse();
  }

  // 用真 ObjectMapper 组装服务。
  private record SupplierInvitationApplicationServiceHarness(
      SupplierInvitationMapper invitationMapper, BuyerSupplierRelationMapper relationMapper) {
    SupplierInvitationApplicationService service() {
      return new SupplierInvitationApplicationService(invitationMapper, relationMapper, new ObjectMapper());
    }
  }
}
