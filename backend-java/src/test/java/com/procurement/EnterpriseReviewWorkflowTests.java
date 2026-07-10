package com.procurement;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.audit.domain.AuditTargetType;
import com.procurement.common.tenant.TenantContext;
import com.procurement.platform.api.AdvanceEnterpriseReviewRequest;
import com.procurement.platform.application.PlatformEnterpriseApplicationService;
import com.procurement.platform.domain.EnterpriseReview;
import com.procurement.platform.domain.EnterpriseReviewStageTransition;
import com.procurement.platform.infrastructure.PlatformEnterpriseMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

// 企业准入审核多步工作流:状态机流转 + 时间线留痕 + 审计明细 + 非法流转/缺理由拦截。
class EnterpriseReviewWorkflowTests {

  private final PlatformEnterpriseMapper mapper = mock(PlatformEnterpriseMapper.class);
  private final AuditLogApplicationService audit = mock(AuditLogApplicationService.class);
  private final PlatformEnterpriseApplicationService service =
      new PlatformEnterpriseApplicationService(mapper, audit, new EnterpriseReviewStageTransition());

  @AfterEach
  void clear() {
    TenantContext.clear();
  }

  private EnterpriseReview review(String status) {
    return new EnterpriseReview("ent-1", "晨光", "supplier", false, status, null, false, false);
  }

  @Test
  void preliminaryPassMovesPendingToPreliminaryAndRecordsEventAndAudit() {
    TenantContext.set(null, null, "user-platform-admin");
    when(mapper.findReviewStatus("ent-1")).thenReturn("pending");
    when(mapper.findById("ent-1")).thenReturn(review("preliminary"));

    service.advanceReview("ent-1", new AdvanceEnterpriseReviewRequest("preliminary_pass", null, null, null));

    verify(mapper).updateSupplierReviewStatus("ent-1", "preliminary");
    verify(mapper).insertReviewEvent(any(), eq("ent-1"), eq("user-platform-admin"),
        eq("preliminary_pass"), eq("pending"), eq("preliminary"), any());
    verify(audit).recordTenantAction(
        eq(null), any(), eq(AuditTargetType.ENTERPRISE), eq("ent-1"),
        org.mockito.ArgumentMatchers.contains("待初审 → 初审通过"));
  }

  @Test
  void rejectRequiresComment() {
    TenantContext.set(null, null, "user-platform-admin");
    when(mapper.findReviewStatus("ent-1")).thenReturn("pending");

    assertThatThrownBy(() ->
        service.advanceReview("ent-1", new AdvanceEnterpriseReviewRequest("reject", "  ", null, null)))
        .isInstanceOf(IllegalArgumentException.class);

    verify(mapper, never()).updateSupplierReviewStatus(any(), any());
  }

  @Test
  void approveRequiresBothConfirmations() {
    TenantContext.set(null, null, "user-platform-admin");
    when(mapper.findReviewStatus("ent-1")).thenReturn("preliminary");

    assertThatThrownBy(() ->
        service.advanceReview("ent-1", new AdvanceEnterpriseReviewRequest("approve", null, true, false)))
        .isInstanceOf(IllegalArgumentException.class);

    verify(mapper, never()).updateSupplierReviewStatus(any(), any());
  }

  @Test
  void approveFromPreliminarySetsVerifiedTrue() {
    TenantContext.set(null, null, "user-platform-admin");
    when(mapper.findReviewStatus("ent-1")).thenReturn("preliminary");
    when(mapper.findById("ent-1")).thenReturn(review("approved"));

    service.advanceReview("ent-1", new AdvanceEnterpriseReviewRequest("approve", "资质齐全", true, true));

    verify(mapper).updateEnterpriseVerified("ent-1", true);
    verify(mapper).updateSupplierReviewStatus("ent-1", "approved");
  }

  @Test
  void illegalTransitionIsRejected() {
    TenantContext.set(null, null, "user-platform-admin");
    when(mapper.findReviewStatus("ent-1")).thenReturn("pending");

    // pending 阶段不能直接 approve(必须先 preliminary_pass)。
    assertThatThrownBy(() ->
        service.advanceReview("ent-1", new AdvanceEnterpriseReviewRequest("approve", null, true, true)))
        .isInstanceOf(IllegalArgumentException.class);

    verify(mapper, never()).insertReviewEvent(any(), any(), any(), any(), any(), any(), any());
  }

  @Test
  void unknownEnterpriseIsRejected() {
    TenantContext.set(null, null, "user-platform-admin");
    when(mapper.findReviewStatus("ghost")).thenReturn(null);

    assertThatThrownBy(() ->
        service.advanceReview("ghost", new AdvanceEnterpriseReviewRequest("preliminary_pass", null, null, null)))
        .isInstanceOf(IllegalArgumentException.class);
  }
}
