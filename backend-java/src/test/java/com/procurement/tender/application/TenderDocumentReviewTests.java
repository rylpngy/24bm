package com.procurement.tender.application;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.procurement.tender.domain.Tender;
import com.procurement.tender.infrastructure.*;
import com.procurement.attachment.application.AttachmentReviewQuery;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.workflow.application.*;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import java.util.List;
import org.junit.jupiter.api.Test;

class TenderDocumentReviewTests {
  final TenderMapper tenders=mock(TenderMapper.class);
  final TenderDocumentReviewMapper reviews=mock(TenderDocumentReviewMapper.class);
  final AttachmentReviewQuery attachments=mock(AttachmentReviewQuery.class);
  final AuditLogApplicationService audit=mock(AuditLogApplicationService.class);
  final TenderDocumentReviewService service=new TenderDocumentReviewService(tenders,reviews,attachments,
      null,null,mock(UnifiedWorkflowApplicationService.class),audit);
  final Tender tender=new Tender("p","t","ZB001","Review","邀请招标",java.math.BigDecimal.TEN,
      "编制中","<p>正文</p>","综合评分法",java.math.BigDecimal.ZERO,null,null,null,"owner",null,null,null,null,null,null,null,null,null,null,null,false);
  TenderDocumentReviewTests() {
    when(attachments.listActiveByTenantAndOwner("t","tender","p")).thenReturn(List.of());
  }
  TenderDocumentReviewMapper.Review review(String status,String fingerprint) {
    return new TenderDocumentReviewMapper.Review("r","t","p",fingerprint,status,"owner",null,null,null,null);
  }
  @Test void rejectsMissingOrUnapprovedReview() {
    when(reviews.list("t","p")).thenReturn(List.of());
    assertThatThrownBy(()->service.requireApproved(tender)).hasMessageContaining("尚未审查通过");
    String fingerprint=service.fingerprint(tender);
    when(reviews.list("t","p")).thenReturn(List.of(review("rejected",fingerprint)));
    assertThatThrownBy(()->service.requireApproved(tender)).isInstanceOf(IllegalStateException.class);
  }
  @Test void requiresExactApprovedVersionAndLocksProcessing() {
    String fingerprint=service.fingerprint(tender);
    when(reviews.list("t","p")).thenReturn(List.of(review("approved",fingerprint)));
    service.requireApproved(tender);
    when(reviews.list("t","p")).thenReturn(List.of(review("approved","old-version")));
    assertThatThrownBy(()->service.requireApproved(tender)).hasMessageContaining("文件已变更");
    when(reviews.list("t","p")).thenReturn(List.of(review("processing","pending")));
    assertThatThrownBy(()->service.requireNotProcessing("t","p")).hasMessageContaining("审查中");
  }
  @Test void callbackRequiresIndependentActorAndWritesOutcomeOnce() {
    var handler=new TenderDocumentReviewHandler(reviews,audit);
    var instance=new WorkflowBusinessInstance("w","t","tender_document_review","r","v","f","processing","owner",null,null,null,null,null,null,null,null);
    when(reviews.lock("t","r")).thenReturn(review("processing","current"));
    assertThat(handler.requiresIndependentApprover()).isTrue();
    assertThatThrownBy(()->handler.onCompleted(instance,new WorkflowCompletion(true,"owner","同意"))).hasMessageContaining("发起人");
    when(reviews.complete("t","r","approved","reviewer","核对通过")).thenReturn(1);
    handler.onCompleted(instance,new WorkflowCompletion(true,"reviewer","核对通过"));
    verify(audit).recordTenantAction("t","tender.document_review.approved","tender","p","核对通过");
  }
}
