package com.procurement.platform.application;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.domain.AuditTargetType;
import com.procurement.platform.api.AdvanceEnterpriseReviewRequest;
import com.procurement.platform.api.EnterpriseReviewEventResponse;
import com.procurement.platform.api.EnterpriseReviewRequest;
import com.procurement.platform.api.EnterpriseReviewResponse;
import com.procurement.platform.domain.EnterpriseReview;
import com.procurement.platform.domain.EnterpriseReviewEvent;
import com.procurement.platform.domain.EnterpriseReviewStage;
import com.procurement.platform.domain.EnterpriseReviewStageTransition;
import com.procurement.platform.domain.PlatformEnterpriseAuditAction;
import com.procurement.platform.infrastructure.PlatformEnterpriseMapper;
import com.procurement.common.tenant.TenantAccessGuard;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PlatformEnterpriseApplicationService {
  private final PlatformEnterpriseMapper platformEnterpriseMapper;
  private final AuditLogApplicationService auditLogApplicationService;
  private final EnterpriseReviewStageTransition reviewStageTransition;

  public PlatformEnterpriseApplicationService(
      PlatformEnterpriseMapper platformEnterpriseMapper,
      AuditLogApplicationService auditLogApplicationService,
      EnterpriseReviewStageTransition reviewStageTransition) {
    this.platformEnterpriseMapper = platformEnterpriseMapper;
    this.auditLogApplicationService = auditLogApplicationService;
    this.reviewStageTransition = reviewStageTransition;
  }

  public List<EnterpriseReviewResponse> listPendingReviews() {
    return platformEnterpriseMapper.listPendingReviews().stream()
        .map(this::toResponse)
        .toList();
  }

  @Transactional
  public EnterpriseReviewResponse reviewEnterprise(String enterpriseId, EnterpriseReviewRequest request) {
    int updated = platformEnterpriseMapper.updateEnterpriseVerified(enterpriseId, request.verified());
    if (updated == 0) {
      throw new IllegalArgumentException("Enterprise not found: " + enterpriseId);
    }
    platformEnterpriseMapper.updateSupplierReviewStatus(enterpriseId, request.reviewStatus());
    platformEnterpriseMapper.updateSupplierReviewDetail(
        enterpriseId,
        request.reviewComment(),
        Boolean.TRUE.equals(request.profileConfirmed()),
        Boolean.TRUE.equals(request.riskConfirmed()));
    auditLogApplicationService.recordTenantAction(
        null,
        PlatformEnterpriseAuditAction.REVIEWED,
        AuditTargetType.ENTERPRISE,
        enterpriseId);
    return toResponse(platformEnterpriseMapper.findById(enterpriseId));
  }

  // 多步审核工作流:按状态机推进一步,写时间线 + 审计(带「从→到」明细)。
  // reject/return 必须填理由;approve 必须已勾资料确认与风险确认。
  @Transactional
  public EnterpriseReviewResponse advanceReview(
      String enterpriseId, AdvanceEnterpriseReviewRequest request) {
    String currentStatus = platformEnterpriseMapper.findReviewStatus(enterpriseId);
    if (currentStatus == null) {
      throw new IllegalArgumentException("Enterprise not found: " + enterpriseId);
    }
    EnterpriseReviewStageTransition.Rule rule =
        reviewStageTransition.resolve(currentStatus, request.action());
    String comment = request.comment() == null ? null : request.comment().trim();
    if (rule.requiresComment() && (comment == null || comment.isBlank())) {
      throw new IllegalArgumentException("该动作必须填写理由: " + request.action());
    }
    boolean approving = EnterpriseReviewStage.APPROVED.equals(rule.toStage());
    if (approving
        && !(Boolean.TRUE.equals(request.profileConfirmed())
            && Boolean.TRUE.equals(request.riskConfirmed()))) {
      throw new IllegalArgumentException("准入通过前需完成资料确认与风险确认");
    }

    platformEnterpriseMapper.updateEnterpriseVerified(enterpriseId, approving);
    platformEnterpriseMapper.updateSupplierReviewStatus(enterpriseId, rule.toStage());
    platformEnterpriseMapper.updateSupplierReviewDetail(
        enterpriseId,
        comment,
        Boolean.TRUE.equals(request.profileConfirmed()),
        Boolean.TRUE.equals(request.riskConfirmed()));
    platformEnterpriseMapper.insertReviewEvent(
        "erv-" + UUID.randomUUID(),
        enterpriseId,
        TenantAccessGuard.requireUserId("platform enterprise review"),
        request.action(),
        currentStatus,
        rule.toStage(),
        comment);

    String detail = "准入审核: " + EnterpriseReviewStage.label(currentStatus)
        + " → " + EnterpriseReviewStage.label(rule.toStage())
        + (comment == null || comment.isBlank() ? "" : "(" + comment + ")");
    auditLogApplicationService.recordTenantAction(
        null, PlatformEnterpriseAuditAction.REVIEWED, AuditTargetType.ENTERPRISE, enterpriseId, detail);
    return toResponse(platformEnterpriseMapper.findById(enterpriseId));
  }

  public List<EnterpriseReviewEventResponse> listReviewEvents(String enterpriseId) {
    return platformEnterpriseMapper.listReviewEvents(enterpriseId).stream()
        .map(this::toEventResponse)
        .toList();
  }

  private EnterpriseReviewEventResponse toEventResponse(EnterpriseReviewEvent event) {
    return new EnterpriseReviewEventResponse(
        event.id(),
        event.action(),
        event.fromStatus(),
        EnterpriseReviewStage.label(event.fromStatus()),
        event.toStatus(),
        EnterpriseReviewStage.label(event.toStatus()),
        event.comment(),
        event.actorId(),
        event.createdAt());
  }

  private EnterpriseReviewResponse toResponse(EnterpriseReview review) {
    return new EnterpriseReviewResponse(
        review.id(),
        review.name(),
        review.type(),
        review.verified(),
        review.reviewStatus(),
        review.reviewComment(),
        review.profileConfirmed(),
        review.riskConfirmed(),
        review.industry(),
        review.creditCode(),
        review.legalPerson(),
        review.contactName(),
        review.contactPhone(),
        review.contactEmail());
  }
}
