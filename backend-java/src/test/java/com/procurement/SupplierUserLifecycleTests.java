package com.procurement;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.supplier.api.ChangeSupplierUserStatusRequest;
import com.procurement.supplier.api.CreateSupplierUserRequest;
import com.procurement.supplier.api.ResetSupplierUserPasswordRequest;
import com.procurement.supplier.application.SupplierUserApplicationService;
import com.procurement.supplier.domain.SupplierUser;
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
      new SupplierUserApplicationService(supplierUserMapper, auditLogApplicationService, passwordEncoder);

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void createSupplierUserUsesCurrentSupplierAndDefaultSupplierRole() {
    TenantContext.set(null, "ent-supplier-sunrise", "user-supplier-sales");
    when(supplierUserMapper.findDefaultSupplierRoleId("ent-supplier-sunrise")).thenReturn("role-supplier-sales");
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
        org.mockito.ArgumentMatchers.eq("role-supplier-sales"));
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
}
