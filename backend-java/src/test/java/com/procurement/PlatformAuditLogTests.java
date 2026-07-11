package com.procurement;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.platform.api.EnterpriseReviewRequest;
import com.procurement.platform.api.FeatureToggleRequest;
import com.procurement.platform.api.UpdateTenantPlanRequest;
import com.procurement.platform.application.PlatformEnterpriseApplicationService;
import com.procurement.platform.application.PlatformTenantApplicationService;
import com.procurement.platform.domain.EnterpriseReview;
import com.procurement.platform.domain.PlatformTenant;
import com.procurement.platform.infrastructure.PlatformEnterpriseMapper;
import com.procurement.platform.infrastructure.PlatformTenantMapper;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

class PlatformAuditLogTests {

  private final AuditLogApplicationService auditLogApplicationService =
      org.mockito.Mockito.mock(AuditLogApplicationService.class);
  private final PasswordEncoder passwordEncoder = org.mockito.Mockito.mock(PasswordEncoder.class);

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void tenantFeatureToggleUpdateRecordsAuditLogInTargetTenant() {
    TenantContext.set(null, null, "user-platform-admin");
    PlatformTenantMapper platformTenantMapper = org.mockito.Mockito.mock(PlatformTenantMapper.class);
    PlatformTenantApplicationService platformTenantApplicationService =
        new PlatformTenantApplicationService(
            platformTenantMapper,
            new ObjectMapper(),
            auditLogApplicationService,
            passwordEncoder,
        org.mockito.Mockito.mock(com.procurement.platform.infrastructure.TenantPlanChangeMapper.class));
    when(platformTenantMapper.updateEnabledFeatures(
            org.mockito.ArgumentMatchers.eq("tenant-1"),
            org.mockito.ArgumentMatchers.anyString()))
        .thenReturn(1);
    when(platformTenantMapper.findById("tenant-1"))
        .thenReturn(new PlatformTenant(
            "tenant-1",
            "示例采购企业",
            "pro",
            "active",
            "[\"rfq\",\"order\"]",
            50));

    platformTenantApplicationService.updateFeatureToggles(
        "tenant-1",
        new FeatureToggleRequest(List.of("rfq", "order")));

    verify(auditLogApplicationService).recordTenantAction(
        "tenant-1",
        "tenant.features.updated",
        "tenant",
        "tenant-1");
  }

  @Test
  void tenantPlanUpdateRecordsAuditLogInTargetTenant() {
    TenantContext.set(null, null, "user-platform-admin");
    PlatformTenantMapper platformTenantMapper = org.mockito.Mockito.mock(PlatformTenantMapper.class);
    PlatformTenantApplicationService platformTenantApplicationService =
        new PlatformTenantApplicationService(
            platformTenantMapper,
            new ObjectMapper(),
            auditLogApplicationService,
            passwordEncoder,
        org.mockito.Mockito.mock(com.procurement.platform.infrastructure.TenantPlanChangeMapper.class));
    when(platformTenantMapper.updatePlan("tenant-1", "pro", 120)).thenReturn(1);
    when(platformTenantMapper.findById("tenant-1"))
        .thenReturn(new PlatformTenant(
            "tenant-1",
            "示例采购企业",
            "pro",
            "active",
            "[\"rfq\",\"order\"]",
            120));

    platformTenantApplicationService.updateTenantPlan(
        "tenant-1",
        new UpdateTenantPlanRequest("pro", 120));

    verify(auditLogApplicationService).recordTenantAction(
        "tenant-1",
        "tenant.plan_updated",
        "tenant",
        "tenant-1");
  }

  @Test
  void tenantEnableRecordsAuditLogInTargetTenant() {
    TenantContext.set(null, null, "user-platform-admin");
    PlatformTenantMapper platformTenantMapper = org.mockito.Mockito.mock(PlatformTenantMapper.class);
    PlatformTenantApplicationService platformTenantApplicationService =
        new PlatformTenantApplicationService(
            platformTenantMapper,
            new ObjectMapper(),
            auditLogApplicationService,
            passwordEncoder,
        org.mockito.Mockito.mock(com.procurement.platform.infrastructure.TenantPlanChangeMapper.class));
    when(platformTenantMapper.updateStatus("tenant-1", "active")).thenReturn(1);
    when(platformTenantMapper.findById("tenant-1"))
        .thenReturn(new PlatformTenant(
            "tenant-1",
            "示例采购企业",
            "pro",
            "active",
            "[\"rfq\",\"order\"]",
            50));

    platformTenantApplicationService.enableTenant("tenant-1");

    verify(auditLogApplicationService).recordTenantAction(
        "tenant-1",
        "tenant.enabled",
        "tenant",
        "tenant-1");
  }

  @Test
  void tenantDisableRecordsAuditLogInTargetTenant() {
    TenantContext.set(null, null, "user-platform-admin");
    PlatformTenantMapper platformTenantMapper = org.mockito.Mockito.mock(PlatformTenantMapper.class);
    PlatformTenantApplicationService platformTenantApplicationService =
        new PlatformTenantApplicationService(
            platformTenantMapper,
            new ObjectMapper(),
            auditLogApplicationService,
            passwordEncoder,
        org.mockito.Mockito.mock(com.procurement.platform.infrastructure.TenantPlanChangeMapper.class));
    when(platformTenantMapper.updateStatus("tenant-1", "inactive")).thenReturn(1);
    when(platformTenantMapper.findById("tenant-1"))
        .thenReturn(new PlatformTenant(
            "tenant-1",
            "示例采购企业",
            "pro",
            "inactive",
            "[\"rfq\",\"order\"]",
            50));

    platformTenantApplicationService.disableTenant("tenant-1");

    verify(auditLogApplicationService).recordTenantAction(
        "tenant-1",
        "tenant.disabled",
        "tenant",
        "tenant-1");
  }

  @Test
  void enterpriseReviewRecordsPlatformAuditLog() {
    TenantContext.set(null, null, "user-platform-admin");
    PlatformEnterpriseMapper platformEnterpriseMapper =
        org.mockito.Mockito.mock(PlatformEnterpriseMapper.class);
    PlatformEnterpriseApplicationService platformEnterpriseApplicationService =
        new PlatformEnterpriseApplicationService(
            platformEnterpriseMapper,
            auditLogApplicationService,
            new com.procurement.platform.domain.EnterpriseReviewStageTransition());
    when(platformEnterpriseMapper.updateEnterpriseVerified("ent-supplier-1", true)).thenReturn(1);
    when(platformEnterpriseMapper.findById("ent-supplier-1"))
        .thenReturn(new EnterpriseReview(
            "ent-supplier-1",
            "晨光供应商",
            "supplier",
            true,
            "approved",
            "资料齐全，准入通过。",
            true,
            true, null, null, null, null, null, null));

    platformEnterpriseApplicationService.reviewEnterprise(
        "ent-supplier-1",
        new EnterpriseReviewRequest(
            true,
            "approved",
            "资料齐全，准入通过。",
            true,
            true));

    verify(platformEnterpriseMapper).updateSupplierReviewDetail(
        "ent-supplier-1",
        "资料齐全，准入通过。",
        true,
        true);

    verify(auditLogApplicationService).recordTenantAction(
        null,
        "enterprise.reviewed",
        "enterprise",
        "ent-supplier-1");
  }
}
