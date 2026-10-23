package com.procurement;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.common.tenant.TenantContext;
import com.procurement.supplier.api.ChangeSupplierQualificationStatusRequest;
import com.procurement.supplier.api.CreateSupplierQualificationRequest;
import com.procurement.supplier.application.SupplierQualificationApplicationService;
import com.procurement.supplier.domain.SupplierQualification;
import com.procurement.supplier.domain.SupplierQualificationStatusTransition;
import com.procurement.supplier.infrastructure.SupplierQualificationMapper;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class SupplierQualificationLifecycleTests {
  private final com.procurement.common.storage.ObjectStorageService storage = org.mockito.Mockito.mock(com.procurement.common.storage.ObjectStorageService.class);

  private final SupplierQualificationMapper supplierQualificationMapper =
      org.mockito.Mockito.mock(SupplierQualificationMapper.class);
  private final SupplierQualificationApplicationService supplierQualificationApplicationService =
      new SupplierQualificationApplicationService(
          supplierQualificationMapper,
          new SupplierQualificationStatusTransition(),
          storage,
          org.mockito.Mockito.mock(com.procurement.supplier.application.QualificationNotificationService.class));

  @AfterEach
  void clearTenantContext() {
    TenantContext.clear();
  }

  @Test
  void createQualificationUsesCurrentSupplierAndStoresActiveMetadata() {
    TenantContext.set(null, "ent-supplier-sunrise", "user-supplier-sales");
    String key = "supplier-qualifications/ent-supplier-sunrise/license.pdf";
    when(storage.get(key)).thenReturn(new com.procurement.common.storage.ObjectStorageService.StoredObject(new byte[] { 1 }, "application/pdf"));
    when(supplierQualificationMapper.originalHash(key)).thenReturn("4bf5122f344554c53bde2ebb8cd2b7e3d1600ad631c385a5d7cce23c7785459a");
    when(supplierQualificationMapper.registerUpload(key, "ent-supplier-sunrise", "license.pdf")).thenReturn(1);
    when(supplierQualificationMapper.findBySupplierAndId(
            org.mockito.ArgumentMatchers.eq("ent-supplier-sunrise"),
            org.mockito.ArgumentMatchers.anyString()))
        .thenAnswer(invocation -> qualification(invocation.getArgument(1)));

    supplierQualificationApplicationService.createCurrentSupplierQualification(
        new CreateSupplierQualificationRequest(
            "营业执照",
            "Q-2026-001",
            LocalDate.now().plusYears(1),
            "license.pdf",
            key));

    verify(supplierQualificationMapper).insert(
        org.mockito.ArgumentMatchers.<String>argThat(id -> id != null && id.startsWith("qual-")),
        org.mockito.ArgumentMatchers.eq("ent-supplier-sunrise"),
        org.mockito.ArgumentMatchers.eq("营业执照"),
        org.mockito.ArgumentMatchers.eq("Q-2026-001"),
        org.mockito.ArgumentMatchers.eq(LocalDate.now().plusYears(1)),
        org.mockito.ArgumentMatchers.eq("license.pdf"),
        org.mockito.ArgumentMatchers.eq(key),
        org.mockito.ArgumentMatchers.eq("active"));
  }

  @Test
  void listQualificationsReadsOnlyCurrentSupplierMetadata() {
    TenantContext.set(null, "ent-supplier-sunrise", "user-supplier-sales");

    supplierQualificationApplicationService.listCurrentSupplierQualifications();

    verify(supplierQualificationMapper).listActiveBySupplier("ent-supplier-sunrise");
  }

  @Test
  void listQualificationsAppliesFiltersInsideCurrentSupplier() {
    TenantContext.set(null, "ent-supplier-sunrise", "user-supplier-sales");

    supplierQualificationApplicationService.listCurrentSupplierQualifications("inactive", "营业");

    verify(supplierQualificationMapper).listBySupplierFiltered(
        "ent-supplier-sunrise",
        "inactive",
        "营业");
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
        LocalDate.now().plusYears(1),
        "license.pdf",
        "suppliers/ent-supplier-sunrise/license.pdf",
        "active",
        OffsetDateTime.parse("2026-06-15T10:00:00+08:00"));
  }

  @Test
  void rejectsCrossSupplierRegistrationBeforeReadingStorage() {
    TenantContext.set(null, "ent-supplier-sunrise", "user-supplier-sales");
    org.assertj.core.api.Assertions.assertThatThrownBy(() -> supplierQualificationApplicationService.createCurrentSupplierQualification(
        new CreateSupplierQualificationRequest("证书", null, null, "a.pdf", "supplier-qualifications/other/a.pdf")))
        .isInstanceOf(IllegalArgumentException.class);
    org.mockito.Mockito.verifyNoInteractions(storage);
  }

  @Test
  void preventsRepeatedOrExpiredUpload() {
    TenantContext.set(null, "ent-supplier-sunrise", "user-supplier-sales");
    org.assertj.core.api.Assertions.assertThatThrownBy(() -> supplierQualificationApplicationService.storeObject(
        "supplier-qualifications/ent-supplier-sunrise/test.pdf", new byte[] {1}, "application/pdf"))
        .isInstanceOf(IllegalArgumentException.class);
    org.mockito.Mockito.verifyNoInteractions(storage);
  }

  @Test
  void cannotEnableReplacedQualification() {
    TenantContext.set(null, "ent-supplier-sunrise", "user-supplier-sales");
    when(supplierQualificationMapper.findBySupplierAndId("ent-supplier-sunrise", "old")).thenReturn(qualification("old"));
    when(supplierQualificationMapper.replacement("ent-supplier-sunrise", "old")).thenReturn("new");
    org.assertj.core.api.Assertions.assertThatThrownBy(() -> supplierQualificationApplicationService.changeQualificationStatus("old", new ChangeSupplierQualificationStatusRequest("active")))
        .isInstanceOf(IllegalArgumentException.class);
    org.mockito.Mockito.verify(supplierQualificationMapper, org.mockito.Mockito.never()).updateStatus(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString());
  }

  @Test
  void refusesTamperedOriginalOnDownload() {
    var qualification = qualification("old");
    when(storage.get(qualification.storageKey())).thenReturn(new com.procurement.common.storage.ObjectStorageService.StoredObject(new byte[] {2}, "application/pdf"));
    when(supplierQualificationMapper.originalHash(qualification.storageKey())).thenReturn("4bf5122f344554c53bde2ebb8cd2b7e3d1600ad631c385a5d7cce23c7785459a");
    org.assertj.core.api.Assertions.assertThatThrownBy(() -> supplierQualificationApplicationService.loadObject(qualification))
        .isInstanceOf(IllegalStateException.class).hasMessageContaining("完整性核验失败");
  }

  @Test
  void rejectsEmptyFileBeforeClaimingTicket() {
    TenantContext.set(null, "ent-supplier-sunrise", "user-supplier-sales");
    org.assertj.core.api.Assertions.assertThatThrownBy(() -> supplierQualificationApplicationService.storeObject(
        "supplier-qualifications/ent-supplier-sunrise/test.pdf", new byte[0], "application/pdf"))
        .isInstanceOf(IllegalArgumentException.class);
    org.mockito.Mockito.verifyNoInteractions(storage, supplierQualificationMapper);
  }
}
