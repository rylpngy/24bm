package com.procurement;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;
import com.procurement.common.tenant.TenantContext;
import com.procurement.common.storage.ObjectStorageService;
import com.procurement.supplier.api.QualificationReviewRequest;
import com.procurement.supplier.application.SupplierQualificationApplicationService;
import com.procurement.supplier.domain.*;
import com.procurement.supplier.infrastructure.SupplierQualificationMapper;
import java.time.*;
import org.junit.jupiter.api.*;

class QualificationReviewTests {
  private final SupplierQualificationMapper mapper = mock(SupplierQualificationMapper.class);
  private final ObjectStorageService storage = mock(ObjectStorageService.class);
  private final com.procurement.supplier.application.QualificationNotificationService notifications = mock(com.procurement.supplier.application.QualificationNotificationService.class);
  private final SupplierQualificationApplicationService service = new SupplierQualificationApplicationService(mapper, new SupplierQualificationStatusTransition(), storage, notifications);
  @BeforeEach void setup() { TenantContext.set("tenant-a", null, "reviewer"); }
  @AfterEach void clear() { TenantContext.clear(); }
  private void fixture(LocalDate expiry) {
    when(mapper.reviewSupplier("tenant-a",1)).thenReturn("supplier");
    when(mapper.reviewQualification("tenant-a",1)).thenReturn("q");
    when(mapper.lockQualification("supplier","q")).thenReturn(new SupplierQualification("q","supplier","证书","001",expiry,"a.pdf","key","active",OffsetDateTime.now()));
    when(storage.get("key")).thenReturn(new ObjectStorageService.StoredObject(new byte[]{1},"application/pdf"));
  }
  @Test void oldDirectReviewCannotBypassFlowable() {
    assertThatThrownBy(() -> service.review(1,new QualificationReviewRequest(true,"直接办理"))).hasMessageContaining("统一审批");
    verifyNoInteractions(mapper,storage,notifications);
  }
  @Test void rejectsOtherTenantRecord() {
    assertThatThrownBy(() -> service.applyWorkflowReview(1,new QualificationReviewRequest(true,"核验通过"))).isInstanceOf(IllegalArgumentException.class);
    verifyNoInteractions(storage);
  }
  @Test void refusesExpiredApproval() {
    fixture(LocalDate.now().minusDays(1));
    assertThatThrownBy(() -> service.applyWorkflowReview(1,new QualificationReviewRequest(true,"核验通过"))).hasMessageContaining("已过期");
    verifyNoInteractions(storage);
  }
  @Test void preservesActorAndOpinionOnRejection() {
    fixture(LocalDate.now().plusDays(1));
    when(mapper.decideReview("tenant-a",1,"rejected","请补件","reviewer")).thenReturn(1);
    service.applyWorkflowReview(1,new QualificationReviewRequest(false," 请补件 "));
    verify(mapper).decideReview("tenant-a",1,"rejected","请补件","reviewer");
    verify(notifications).reviewCompleted("tenant-a", 1);
    verifyNoInteractions(storage);
  }
  @Test void rejectsRepeatedDecision() {
    fixture(LocalDate.now().plusDays(1));
    assertThatThrownBy(() -> service.applyWorkflowReview(1,new QualificationReviewRequest(true,"核验通过"))).hasMessageContaining("已办理");
    verifyNoInteractions(notifications);
  }
  @Test void refusesReplacedVersion() {
    fixture(LocalDate.now().plusDays(1));
    when(mapper.replacement("supplier","q")).thenReturn("q2");
    assertThatThrownBy(() -> service.applyWorkflowReview(1,new QualificationReviewRequest(true,"核验通过"))).hasMessageContaining("已变更");
  }
}
