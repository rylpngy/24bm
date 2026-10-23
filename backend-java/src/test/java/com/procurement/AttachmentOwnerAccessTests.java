package com.procurement;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

import com.procurement.attachment.application.AttachmentAccessService;
import com.procurement.attachment.application.AttachmentOwnerAccess;
import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.common.tenant.TenantContext;
import com.procurement.contract.application.ContractAttachmentAccess;
import com.procurement.contract.infrastructure.ContractMapper;
import com.procurement.identity.application.DataScopeService;
import com.procurement.identity.application.PermissionService;
import com.procurement.identity.domain.DataScope;
import com.procurement.ludongpoc.application.LudongAttachmentAccess;
import com.procurement.ludongpoc.domain.LudongPocApplication;
import com.procurement.ludongpoc.infrastructure.LudongPocApplicationMapper;
import com.procurement.supplier.application.SupplierAttachmentAccess;
import com.procurement.supplier.infrastructure.BuyerSupplierRelationMapper;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class AttachmentOwnerAccessTests {
  @AfterEach void clear() { TenantContext.clear(); }

  @Test void unknownAndDuplicateOwnerTypesAreNotSilentlyAccepted() {
    assertThatThrownBy(() -> new AttachmentAccessService(List.of()).requireAccess("unknown", "id", false))
        .isInstanceOf(PermissionDeniedException.class);
    AttachmentOwnerAccess policy = mock(AttachmentOwnerAccess.class);
    when(policy.ownerTypes()).thenReturn(Set.of("demand"));
    assertThatThrownBy(() -> new AttachmentAccessService(List.of(policy, policy)))
        .isInstanceOf(IllegalStateException.class);
  }

  @Test void supplierAttachmentsRequireAnExistingPrivateRelationshipAndManagePermission() {
    TenantContext.set("tenant", null, "user");
    var mapper = mock(BuyerSupplierRelationMapper.class);
    var permissions = mock(PermissionService.class);
    var policy = new SupplierAttachmentAccess(mapper, permissions);
    assertThatThrownBy(() -> policy.requireAccess("public-supplier", false)).isInstanceOf(PermissionDeniedException.class);
    when(mapper.countByTenantSupplier("tenant", "supplier")).thenReturn(1);
    policy.requireAccess("supplier", true);
    verify(permissions).require("buyer:supplier:manage");
  }

  @Test void contractAttachmentsUseTheSameDepartmentAndCreatorScopeAsContracts() {
    TenantContext.set("tenant", null, "user");
    var mapper = mock(ContractMapper.class);
    var permissions = mock(PermissionService.class);
    var scopes = mock(DataScopeService.class);
    var policy = new ContractAttachmentAccess(mapper, permissions, scopes);
    when(scopes.currentUserDataScope()).thenReturn(DataScope.departments(List.of("dept")));
    assertThatThrownBy(() -> policy.requireAccess("contract", false)).isInstanceOf(PermissionDeniedException.class);
    verify(mapper).canAccessAttachment("tenant", "contract", List.of("dept"), null);
    when(scopes.currentUserDataScope()).thenReturn(DataScope.self("user"));
    when(mapper.canAccessAttachment("tenant", "contract", null, "user")).thenReturn(true);
    policy.requireAccess("contract", false);
    verify(permissions, times(2)).require("buyer:contract:read");
  }

  @Test void ludongExportAndReviewPermissionsAllowReadingButNeverUploadingByThemselves() {
    TenantContext.set("tenant", null, "user");
    var mapper = mock(LudongPocApplicationMapper.class);
    var permissions = mock(PermissionService.class);
    var scopes = mock(DataScopeService.class);
    var application = new LudongPocApplication("application", "tenant", "NO-1", "Project", "Unit", "dept",
        java.math.BigDecimal.ZERO, "草稿", "{}", "[]", "applicant", null, null, null, null, null, null);
    when(mapper.findByTenantAndId("tenant", "application")).thenReturn(application);
    when(permissions.currentUserHas("buyer:ludong-poc:export")).thenReturn(true);
    var policy = new LudongAttachmentAccess(mapper, permissions, scopes);
    policy.requireAccess("application", false);
    verify(scopes).requireRecordAccess("dept", "applicant");
    verify(permissions, never()).require(anyString());
    doThrow(new PermissionDeniedException("no write")).when(permissions).require("buyer:ludong-poc:write");
    assertThatThrownBy(() -> policy.requireAccess("application", true)).isInstanceOf(PermissionDeniedException.class);
  }
}
