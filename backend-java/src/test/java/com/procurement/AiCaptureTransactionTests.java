package com.procurement;

import static org.assertj.core.api.Assertions.*;
import com.procurement.attachment.application.AttachmentAiSubjectAdapter;
import com.procurement.demand.application.DemandAiSubjectAdapter;
import com.procurement.supplier.application.SupplierAiSubjectAdapter;
import com.procurement.sourcing.application.ProcurementExecutionApplicationService;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.annotation.*;

class AiCaptureTransactionTests {
  @Test void eachSourceCaptureStartsItsOwnRepeatableReadSnapshot() throws Exception {
    for(Class<?> type:new Class<?>[] {DemandAiSubjectAdapter.class,AttachmentAiSubjectAdapter.class,SupplierAiSubjectAdapter.class})
      assertCapture(type.getMethod("capture",String.class).getAnnotation(Transactional.class));
    assertCapture(ProcurementExecutionApplicationService.class.getMethod("captureAiEvidence",String.class).getAnnotation(Transactional.class));
  }
  @Test void orchestrationDoesNotHoldATransactionAcrossExternalModelCalls() throws Exception {
    var annotation=com.procurement.ai.application.AiReviewApplicationService.class
        .getMethod("create",com.procurement.ai.api.AiReviewDtos.CreateReview.class).getAnnotation(Transactional.class);
    assertThat(annotation.propagation()).isEqualTo(Propagation.NOT_SUPPORTED);
    assertThat(com.procurement.ai.application.AiReviewPersistence.class.getMethod("save",
        com.procurement.common.ai.AiContracts.Review.class,String.class).getAnnotation(Transactional.class)).isNotNull();
  }
  private void assertCapture(Transactional annotation) {
    assertThat(annotation).isNotNull(); assertThat(annotation.readOnly()).isTrue();
    assertThat(annotation.isolation()).isEqualTo(Isolation.REPEATABLE_READ);
    assertThat(annotation.propagation()).isEqualTo(Propagation.REQUIRES_NEW);
  }
}
