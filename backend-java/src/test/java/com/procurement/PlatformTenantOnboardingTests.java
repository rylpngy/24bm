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

class PlatformTenantOnboardingTests {

  private final PlatformTenantMapper platformTenantMapper =
      org.mockito.Mockito.mock(PlatformTenantMapper.class);
  private final AuditLogApplicationService auditLogApplicationService =
      org.mockito.Mockito.mock(AuditLogApplicationService.class);
  private final PlatformTenantApplicationService platformTenantApplicationService =
      new PlatformTenantApplicationService(
          platformTenantMapper,
          new ObjectMapper(),
          auditLogApplicationService);

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

    platformTenantApplicationService.createBuyerTenant(new CreateTenantRequest(
        "tenant-demo",
        "ent-demo-buyer",
        "示例采购企业",
        "综合采购",
        "MVP",
        50,
        List.of("rfq", "order", "finance")));

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
}
