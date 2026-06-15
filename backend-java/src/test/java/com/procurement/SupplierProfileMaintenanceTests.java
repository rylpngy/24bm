package com.procurement;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.tenant.TenantContext;
import com.procurement.supplier.api.UpdateSupplierProfileRequest;
import com.procurement.supplier.application.SupplierProfileApplicationService;
import com.procurement.supplier.domain.SupplierProfile;
import com.procurement.supplier.infrastructure.SupplierProfileMapper;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class SupplierProfileMaintenanceTests {

  private final SupplierProfileMapper supplierProfileMapper =
      org.mockito.Mockito.mock(SupplierProfileMapper.class);
  private final AuditLogApplicationService auditLogApplicationService =
      org.mockito.Mockito.mock(AuditLogApplicationService.class);
  private final SupplierProfileApplicationService supplierProfileApplicationService =
      new SupplierProfileApplicationService(supplierProfileMapper, auditLogApplicationService);

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void updateProfileUsesCurrentSupplierAndLeavesReviewStateToPlatform() {
    TenantContext.set(null, "ent-supplier-sunrise", "user-supplier-sales");
    when(supplierProfileMapper.findBySupplierId("ent-supplier-sunrise"))
        .thenReturn(profile(
            "晨光科技供应商",
            "办公设备",
            "91310000MA1K2026X1",
            "王小明",
            "approved",
            "published"));
    when(supplierProfileMapper.listConnectedBuyerNames("ent-supplier-sunrise"))
        .thenReturn(List.of("Acme 采购公司"));

    supplierProfileApplicationService.updateCurrentSupplierProfile(
        new UpdateSupplierProfileRequest(
            "晨光科技集团",
            "办公设备与企业服务",
            "91310000MA1K2026X8",
            "李小明"));

    verify(supplierProfileMapper).updateEnterpriseProfile(
        "ent-supplier-sunrise",
        "晨光科技集团",
        "办公设备与企业服务");
    verify(supplierProfileMapper).updateSupplierEnterpriseProfile(
        "ent-supplier-sunrise",
        "91310000MA1K2026X8",
        "李小明");
    verify(auditLogApplicationService).recordTenantAction(
        null,
        "supplier_profile.updated",
        "supplier_profile",
        "ent-supplier-sunrise");
  }

  private SupplierProfile profile(
      String name,
      String industry,
      String creditCode,
      String legalPerson,
      String verifiedStatus,
      String profileStatus) {
    return new SupplierProfile(
        "ent-supplier-sunrise",
        name,
        "supplier",
        industry,
        true,
        creditCode,
        legalPerson,
        verifiedStatus,
        profileStatus);
  }
}
