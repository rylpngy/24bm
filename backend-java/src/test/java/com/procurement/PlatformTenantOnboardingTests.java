package com.procurement;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.platform.api.CreateTenantRequest;
import com.procurement.platform.application.PlatformTenantApplicationService;
import com.procurement.platform.domain.PlatformTenant;
import com.procurement.platform.infrastructure.PlatformTenantMapper;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

class PlatformTenantOnboardingTests {

  private final PlatformTenantMapper platformTenantMapper =
      org.mockito.Mockito.mock(PlatformTenantMapper.class);
  private final AuditLogApplicationService auditLogApplicationService =
      org.mockito.Mockito.mock(AuditLogApplicationService.class);
  private final PasswordEncoder passwordEncoder = org.mockito.Mockito.mock(PasswordEncoder.class);
  private final PlatformTenantApplicationService platformTenantApplicationService =
      new PlatformTenantApplicationService(
          platformTenantMapper,
          new ObjectMapper(),
          auditLogApplicationService,
          passwordEncoder,
        org.mockito.Mockito.mock(com.procurement.platform.infrastructure.TenantPlanChangeMapper.class));

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void createBuyerTenantInitializesEnterpriseRolesAndFixedApprovalTemplates() {
    TenantContext.set(null, null, "user-platform-admin");
    when(platformTenantMapper.findById("tenant-demo"))
        .thenReturn(new PlatformTenant(
            "tenant-demo",
            "示例采购企业",
            "MVP",
            "active",
            "[\"rfq\",\"order\",\"finance\"]",
            50));
    when(passwordEncoder.encode("owner-password")).thenReturn("{bcrypt}owner-hash");

    platformTenantApplicationService.createBuyerTenant(new CreateTenantRequest(
        "tenant-demo",
        "ent-demo-buyer",
        "示例采购企业",
        "综合采购",
        "MVP",
        50,
        List.of("rfq", "order", "finance"),
        "首席采购管理员",
        "13900000001",
        "owner@demo.example.com",
        "owner-password"));

    verify(platformTenantMapper).insertTenant(
        "tenant-demo",
        "示例采购企业",
        "MVP",
        "active",
        "[\"rfq\",\"order\",\"finance\"]",
        50);
    verify(platformTenantMapper).insertBuyerEnterprise(
        "ent-demo-buyer",
        "示例采购企业",
        "综合采购",
        true);
    verify(platformTenantMapper).insertBuyerAdminRole(
        "role-tenant-demo-buyer-owner",
        "tenant-demo",
        "采购管理员",
        "[\"buyer:*\"]");
    verify(platformTenantMapper).insertInitialBuyerAdminUser(
        "user-tenant-demo-owner",
        "tenant-demo",
        "首席采购管理员",
        "13900000001",
        "owner@demo.example.com",
        "active",
        "{bcrypt}owner-hash");
    verify(platformTenantMapper).assignUserRole(
        "user-tenant-demo-owner",
        "role-tenant-demo-buyer-owner");
    verify(platformTenantMapper).insertApprovalTemplate(
        "TPL_PURCHASE_DEMAND",
        "tenant-demo",
        "purchase_demand",
        "需求审批",
        "role-tenant-demo-buyer-owner",
        "active",
        10);
    verify(platformTenantMapper).insertApprovalTemplate(
        "TPL_SUPPLIER_ADMISSION",
        "tenant-demo",
        "buyer_supplier_admission",
        "供应商准入",
        "role-tenant-demo-buyer-owner",
        "active",
        20);
    verify(platformTenantMapper).insertApprovalTemplate(
        "TPL_RFQ_AWARD",
        "tenant-demo",
        "rfq_award",
        "定标审批",
        "role-tenant-demo-buyer-owner",
        "active",
        30);
    verify(auditLogApplicationService).recordTenantAction(
        "tenant-demo",
        "tenant.created",
        "tenant",
        "tenant-demo");
  }

  @Test
  void createSupplierEnterpriseInitializesProfileAndAdminUser() {
    TenantContext.set(null, null, "user-platform-admin");
    when(passwordEncoder.encode("supplier-pass")).thenReturn("{bcrypt}supplier-hash");

    var response = platformTenantApplicationService.createSupplierEnterprise(
        new com.procurement.platform.api.CreateSupplierEnterpriseRequest(
            "ent-pilot-supplier", "试点机电设备公司", "机电设备",
            "91310000PILOT001", "张三",
            "供应商管理员", "13800000001", "sales@pilot-supplier.example.com", "supplier-pass"));

    org.assertj.core.api.Assertions.assertThat(response.adminUserId())
        .isEqualTo("user-ent-pilot-supplier-owner");
    verify(platformTenantMapper).insertSupplierEnterprise(
        "ent-pilot-supplier", "试点机电设备公司", "机电设备");
    verify(platformTenantMapper).insertSupplierEnterpriseDetail(
        "ent-pilot-supplier", "91310000PILOT001", "张三");
    verify(platformTenantMapper).insertInitialSupplierAdminUser(
        "user-ent-pilot-supplier-owner",
        "ent-pilot-supplier",
        "供应商管理员",
        "13800000001",
        "sales@pilot-supplier.example.com",
        "active",
        "{bcrypt}supplier-hash");
  }

  @Test
  void createSupplierEnterpriseRejectsDuplicateEnterpriseId() {
    TenantContext.set(null, null, "user-platform-admin");
    when(platformTenantMapper.countEnterpriseById("ent-dup")).thenReturn(1);

    org.assertj.core.api.Assertions.assertThatThrownBy(() ->
        platformTenantApplicationService.createSupplierEnterprise(
            new com.procurement.platform.api.CreateSupplierEnterpriseRequest(
                "ent-dup", "重复企业", "机电", null, null,
                "管理员", null, "a@b.example.com", "supplier-pass")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("已存在");
  }
}
