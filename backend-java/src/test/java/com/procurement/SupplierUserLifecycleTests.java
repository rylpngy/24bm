package com.procurement;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.supplier.api.ChangeSupplierUserStatusRequest;
import com.procurement.supplier.api.ChangeSupplierUserRoleRequest;
import com.procurement.supplier.api.UpdateSupplierUserRequest;
import com.procurement.supplier.api.CreateSupplierUserRequest;
import com.procurement.supplier.api.ResetSupplierUserPasswordRequest;
import com.procurement.supplier.application.SupplierUserApplicationService;
import com.procurement.supplier.domain.SupplierUser;
import com.procurement.supplier.domain.SupplierUserStatusTransition;
import com.procurement.supplier.infrastructure.SupplierUserMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

class SupplierUserLifecycleTests {

  private final SupplierUserMapper supplierUserMapper = org.mockito.Mockito.mock(SupplierUserMapper.class);
  private final AuditLogApplicationService auditLogApplicationService =
      org.mockito.Mockito.mock(AuditLogApplicationService.class);
  private final PasswordEncoder passwordEncoder = org.mockito.Mockito.mock(PasswordEncoder.class);
  private final SupplierUserApplicationService supplierUserApplicationService =
      new SupplierUserApplicationService(
          supplierUserMapper,
          auditLogApplicationService,
          passwordEncoder,
          new SupplierUserStatusTransition(),
          org.mockito.Mockito.mock(com.procurement.identity.application.PermissionService.class));

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void createSupplierUserUsesCurrentSupplierAndDefaultSupplierRole() {
    TenantContext.set(null, "ent-supplier-sunrise", "user-supplier-sales");
    when(supplierUserMapper.findDefaultSupplierRoleId("ent-supplier-sunrise")).thenReturn("role-system-supplier-member");
    when(passwordEncoder.encode("initial-password")).thenReturn("{bcrypt}initial-hash");
    when(supplierUserMapper.findBySupplierAndId(
            org.mockito.ArgumentMatchers.eq("ent-supplier-sunrise"),
            org.mockito.ArgumentMatchers.anyString()))
        .thenAnswer(invocation -> user(invocation.getArgument(1)));

    supplierUserApplicationService.createCurrentSupplierUser(new CreateSupplierUserRequest(
        "供应商财务",
        "13800009999",
        "supplier.finance@example.com",
        "active",
        "initial-password"));

    verify(supplierUserMapper).insert(
        org.mockito.ArgumentMatchers.<String>argThat(id -> id != null && id.startsWith("user-")),
        org.mockito.ArgumentMatchers.eq("ent-supplier-sunrise"),
        org.mockito.ArgumentMatchers.eq("供应商财务"),
        org.mockito.ArgumentMatchers.eq("13800009999"),
        org.mockito.ArgumentMatchers.eq("supplier.finance@example.com"),
        org.mockito.ArgumentMatchers.eq("active"),
        org.mockito.ArgumentMatchers.eq("{bcrypt}initial-hash"));
    verify(supplierUserMapper).assignRole(
        org.mockito.ArgumentMatchers.<String>argThat(id -> id != null && id.startsWith("user-")),
        org.mockito.ArgumentMatchers.eq("role-system-supplier-member"));
    verify(auditLogApplicationService).recordTenantAction(
        org.mockito.ArgumentMatchers.isNull(),
        org.mockito.ArgumentMatchers.eq("supplier_user.created"),
        org.mockito.ArgumentMatchers.eq("supplier_user"),
        org.mockito.ArgumentMatchers.<String>argThat(id -> id != null && id.startsWith("user-")));
  }

  @Test
  void listSupplierUsersReadsOnlyCurrentSupplierUsers() {
    TenantContext.set(null, "ent-supplier-sunrise", "user-supplier-sales");

    supplierUserApplicationService.listCurrentSupplierUsers();

    verify(supplierUserMapper).listBySupplier("ent-supplier-sunrise");
  }

  @Test
  void listSupplierUsersAppliesFiltersInsideCurrentSupplier() {
    TenantContext.set(null, "ent-supplier-sunrise", "user-supplier-sales");

    supplierUserApplicationService.listCurrentSupplierUsers("active", "财务");

    verify(supplierUserMapper).listBySupplierFiltered(
        "ent-supplier-sunrise",
        "active",
        "财务");
  }

  @Test
  void resetSupplierUserPasswordHashesNewPasswordInCurrentSupplierScope() {
    TenantContext.set(null, "ent-supplier-sunrise", "user-supplier-sales");
    when(supplierUserMapper.existsBySupplierAndId("ent-supplier-sunrise", "user-supplier-finance"))
        .thenReturn(true);
    when(passwordEncoder.encode("new-password")).thenReturn("{bcrypt}new-hash");
    when(supplierUserMapper.findBySupplierAndId("ent-supplier-sunrise", "user-supplier-finance"))
        .thenReturn(user("user-supplier-finance"));

    supplierUserApplicationService.resetUserPassword(
        "user-supplier-finance",
        new ResetSupplierUserPasswordRequest("new-password"));

    verify(supplierUserMapper).updatePasswordHash(
        "ent-supplier-sunrise",
        "user-supplier-finance",
        "{bcrypt}new-hash");
    verify(auditLogApplicationService).recordTenantAction(
        null,
        "supplier_user.password_reset",
        "supplier_user",
        "user-supplier-finance");
  }

  @Test
  void changeSupplierUserStatusUpdatesOnlyCurrentSupplierUser() {
    TenantContext.set(null, "ent-supplier-sunrise", "user-supplier-sales");
    when(supplierUserMapper.countOtherActiveAdmins("ent-supplier-sunrise", "user-supplier-finance")).thenReturn(1);
    when(supplierUserMapper.existsBySupplierAndId("ent-supplier-sunrise", "user-supplier-finance"))
        .thenReturn(true);
    when(supplierUserMapper.findBySupplierAndId("ent-supplier-sunrise", "user-supplier-finance"))
        .thenReturn(user("user-supplier-finance"));

    supplierUserApplicationService.changeUserStatus(
        "user-supplier-finance",
        new ChangeSupplierUserStatusRequest("inactive"));

    verify(supplierUserMapper).updateStatus(
        "ent-supplier-sunrise",
        "user-supplier-finance",
        "inactive");
    verify(auditLogApplicationService).recordTenantAction(
        null,
        "supplier_user.status_changed",
        "supplier_user",
        "user-supplier-finance");
  }

  @Test
  void changeSupplierUserStatusRejectsUnsupportedStatus() {
    TenantContext.set(null, "ent-supplier-sunrise", "user-supplier-sales");
    when(supplierUserMapper.existsBySupplierAndId("ent-supplier-sunrise", "user-supplier-finance"))
        .thenReturn(true);

    Assertions.assertThrows(
        IllegalArgumentException.class,
        () -> supplierUserApplicationService.changeUserStatus(
            "user-supplier-finance",
            new ChangeSupplierUserStatusRequest("locked")));
  }

  private SupplierUser user(String id) {
    return new SupplierUser(
        id,
        "ent-supplier-sunrise",
        "供应商财务",
        "13800009999",
        "supplier.finance@example.com",
        "active",
        "role-supplier-sales");
  }

  private void prepareRoleChange() {
    TenantContext.set(null, "ent-supplier-sunrise", "owner");
    when(supplierUserMapper.existsBySupplierAndId("ent-supplier-sunrise", "member")).thenReturn(true);
    when(supplierUserMapper.existsSupplierRole("ent-supplier-sunrise", "role-system-supplier-member")).thenReturn(true);
    when(supplierUserMapper.countOtherActiveAdmins("ent-supplier-sunrise", "member")).thenReturn(1);
    when(supplierUserMapper.findBySupplierAndId("ent-supplier-sunrise", "member")).thenReturn(user("member"));
  }

  @Test
  void profileNormalizesContactsAndKeepsRolesUntouched() {
    prepareRoleChange();
    supplierUserApplicationService.updateUserProfile("member", new UpdateSupplierUserRequest("  成员  ", "13800009999", "Member@Example.com"));
    verify(supplierUserMapper).hasLoginConflict("ent-supplier-sunrise", "member", "13800009999", "member@example.com");
    verify(supplierUserMapper).updateProfile("ent-supplier-sunrise", "member", "成员", "13800009999", "member@example.com");
    org.mockito.Mockito.verify(supplierUserMapper, org.mockito.Mockito.never()).clearUserRoles(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString());
  }

  @Test
  void contactValidationRejectsMissingInvalidAndOccupiedAccounts() {
    prepareRoleChange();
    Assertions.assertThrows(IllegalArgumentException.class, () -> supplierUserApplicationService.updateUserProfile(
        "member", new UpdateSupplierUserRequest("成员", " ", "")));
    Assertions.assertThrows(IllegalArgumentException.class, () -> supplierUserApplicationService.updateUserProfile(
        "member", new UpdateSupplierUserRequest("成员", "abc", null)));
    when(supplierUserMapper.hasLoginConflict("ent-supplier-sunrise", "member", null, "used@example.com")).thenReturn(true);
    Assertions.assertThrows(IllegalArgumentException.class, () -> supplierUserApplicationService.updateUserProfile(
        "member", new UpdateSupplierUserRequest("成员", null, "USED@example.com")));
    org.mockito.Mockito.verify(supplierUserMapper, org.mockito.Mockito.never()).updateProfile(
        org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
  }

  @Test
  void profileRejectsForeignMemberAndCreateWithoutLoginContact() {
    prepareRoleChange();
    Assertions.assertThrows(IllegalArgumentException.class, () -> supplierUserApplicationService.updateUserProfile(
        "foreign", new UpdateSupplierUserRequest("成员", null, "other@example.com")));
    Assertions.assertThrows(IllegalArgumentException.class, () -> supplierUserApplicationService.createCurrentSupplierUser(
        new CreateSupplierUserRequest("成员", null, null, "active", "demo123456")));
  }

  @Test
  void roleReplacementClearsLegacyGrantsAndInvalidatesSessions() {
    prepareRoleChange();
    supplierUserApplicationService.changeUserRole("member", new ChangeSupplierUserRoleRequest("role-system-supplier-member"));
    var ordered = org.mockito.Mockito.inOrder(supplierUserMapper);
    ordered.verify(supplierUserMapper).lockSupplier("ent-supplier-sunrise");
    ordered.verify(supplierUserMapper).clearUserRoles("ent-supplier-sunrise", "member");
    ordered.verify(supplierUserMapper).assignRole("member", "role-system-supplier-member");
    ordered.verify(supplierUserMapper).invalidateSessions("ent-supplier-sunrise", "member");
    verify(auditLogApplicationService).recordTenantAction(null,
        "supplier_user.role_changed:role-system-supplier-member", "supplier_user", "member");
  }

  @Test
  void roleReplacementRejectsForeignUsersAndArbitraryRoles() {
    prepareRoleChange();
    Assertions.assertThrows(IllegalArgumentException.class, () -> supplierUserApplicationService.changeUserRole(
        "foreign-user", new ChangeSupplierUserRoleRequest("role-system-supplier-member")));
    Assertions.assertThrows(IllegalArgumentException.class, () -> supplierUserApplicationService.changeUserRole(
        "member", new ChangeSupplierUserRoleRequest("role-platform-admin")));
    org.mockito.Mockito.verify(supplierUserMapper, org.mockito.Mockito.never())
        .clearUserRoles(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString());
  }

  @Test
  void roleReplacementProtectsSelfAndLastAdministrator() {
    prepareRoleChange();
    when(supplierUserMapper.existsBySupplierAndId("ent-supplier-sunrise", "owner")).thenReturn(true);
    Assertions.assertThrows(IllegalArgumentException.class, () -> supplierUserApplicationService.changeUserRole(
        "owner", new ChangeSupplierUserRoleRequest("role-system-supplier-member")));
    when(supplierUserMapper.countOtherActiveAdmins("ent-supplier-sunrise", "member")).thenReturn(0);
    Assertions.assertThrows(IllegalArgumentException.class, () -> supplierUserApplicationService.changeUserRole(
        "member", new ChangeSupplierUserRoleRequest("role-system-supplier-member")));
    org.mockito.Mockito.verify(supplierUserMapper, org.mockito.Mockito.never())
        .clearUserRoles(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString());
  }
}
