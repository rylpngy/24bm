package com.procurement.ai.application;

import com.procurement.ai.infrastructure.AiReviewMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.common.ai.AiContracts.Review;
import com.procurement.common.ai.AiSupport;
import com.procurement.common.tenant.TenantAccessGuard;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The case file and its audit commit together, without holding a connection during model I/O. */
@Service
public class AiReviewPersistence {
  private final AiReviewMapper mapper;
  private final AuditLogApplicationService audit;
  public AiReviewPersistence(AiReviewMapper mapper,AuditLogApplicationService audit) { this.mapper=mapper; this.audit=audit; }
  @Transactional
  public void save(Review review,String payload) {
    String tenant=TenantAccessGuard.requireTenantId("AI review persistence");
    String user=TenantAccessGuard.requireUserId("AI review persistence");
    mapper.insertRun(review.runId(),tenant,review.subjectType(),review.subjectId(),review.sourceRevision(),payload,
        AiSupport.hash(AiSupport.utf8(payload)),user,review.createdAt());
    audit.recordCurrentTenantAction("ai.review.generated","ai_review",review.runId(),
        "subject="+review.subjectType()+"/"+review.subjectId()+";mode="+review.mode()+";revision="+review.sourceRevision());
  }
}
