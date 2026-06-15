package com.procurement;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.common.tenant.TenantContext;
import com.procurement.supplier.api.ChangeSupplierQualificationStatusRequest;
import com.procurement.supplier.api.CreateSupplierQualificationRequest;
import com.procurement.supplier.application.SupplierQualificationApplicationService;
import com.procurement.supplier.domain.SupplierQualification;
import com.procurement.supplier.infrastructure.SupplierQualificationMapper;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class SupplierQualificationLifecycleTests {

  private final SupplierQualificationMapper supplierQualificationMapper =
      org.mockito.Mockito.mock(SupplierQualificationMapper.class);
  private final SupplierQualificationApplicationService supplierQualificationApplicationService =
      new SupplierQualificationApplicationService(supplierQualificationMapper);

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void createQualificationUsesCurrentSupplierAndStoresActiveMetadata() {
    TenantContext.set(null, "ent-supplier-sunrise", "user-supplier-sales");
    when(supplierQualificationMapper.findBySupplierAndId(
            org.mockito.ArgumentMatchers.eq("ent-supplier-sunrise"),
            org.mockito.ArgumentMatchers.anyString()))
        .thenAnswer(invocation -> qualification(invocation.getArgument(1)));

    supplierQualificationApplicationService.createCurrentSupplierQualification(
        new CreateSupplierQualificationRequest(
            "营业执照",
            "Q-2026-001",
            LocalDate.parse("2027-12-31"),
            "license.pdf",
            "suppliers/ent-supplier-sunrise/license.pdf"));

    verify(supplierQualificationMapper).insert(
        org.mockito.ArgumentMatchers.<String>argThat(id -> id != null && id.startsWith("qual-")),
        org.mockito.ArgumentMatchers.eq("ent-supplier-sunrise"),
        org.mockito.ArgumentMatchers.eq("营业执照"),
        org.mockito.ArgumentMatchers.eq("Q-2026-001"),
        org.mockito.ArgumentMatchers.eq(LocalDate.parse("2027-12-31")),
        org.mockito.ArgumentMatchers.eq("license.pdf"),
        org.mockito.ArgumentMatchers.eq("suppliers/ent-supplier-sunrise/license.pdf"),
        org.mockito.ArgumentMatchers.eq("active"));
  }

  @Test
  void listQualificationsReadsOnlyCurrentSupplierMetadata() {
    TenantContext.set(null, "ent-supplier-sunrise", "user-supplier-sales");

    supplierQualificationApplicationService.listCurrentSupplierQualifications();

    verify(supplierQualificationMapper).listActiveBySupplier("ent-supplier-sunrise");
  }

  @Test
  void changeQualificationStatusUsesCurrentSupplierScope() {
    TenantContext.set(null, "ent-supplier-sunrise", "user-supplier-sales");
    when(supplierQualificationMapper.findBySupplierAndId("ent-supplier-sunrise", "qual-demo"))
        .thenReturn(qualification("qual-demo"));

    supplierQualificationApplicationService.changeQualificationStatus(
        "qual-demo",
        new ChangeSupplierQualificationStatusRequest("inactive"));

    verify(supplierQualificationMapper).updateStatus(
        "ent-supplier-sunrise",
        "qual-demo",
        "inactive");
  }

  private SupplierQualification qualification(String id) {
    return new SupplierQualification(
        id,
        "ent-supplier-sunrise",
        "营业执照",
        "Q-2026-001",
        LocalDate.parse("2027-12-31"),
        "license.pdf",
        "suppliers/ent-supplier-sunrise/license.pdf",
        "active",
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"));
  }
}
