package com.procurement.agency;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.procurement.agency.application.*;
import com.procurement.agency.domain.AgencyRecords.*;
import com.procurement.agency.infrastructure.AgencyMapper;
import com.procurement.audit.application.AuditLogApplicationService;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import org.junit.jupiter.api.Test;

class AgencyReviewProjectorTests {
  final AgencyMapper mapper = mock(AgencyMapper.class);
  final AuditLogApplicationService audit = mock(AuditLogApplicationService.class);
  final AgencyReviewProjector projector = new AgencyReviewProjector(mapper, null, audit);

  WorkflowBusinessInstance instance() {
    return new WorkflowBusinessInstance(
        "w",
        "t",
        "agency_package_archive",
        "r",
        "definition",
        "flow",
        "processing",
        "creator",
        "dept",
        null,
        null,
        null,
        null,
        null,
        null,
        null);
  }

  Review review(String status) {
    return new Review("r", "t", "p", "archive", 1, "{}", "{}", status, "creator", "w", null, null);
  }

  PackageRow record(long version) {
    return new PackageRow(
        "p",
        "t",
        null,
        "title",
        "ZC",
        "FW",
        "询价",
        null,
        null,
        "half",
        "dept",
        "creator",
        null,
        null,
        "CNY",
        "reviewing",
        "ZC-FW-202611-0001",
        2026,
        1,
        version,
        "{}",
        "w",
        "creator",
        null,
        null,
        "not_started",
        "accumulating",
        "unassessed");
  }

  @Test
  void callbackRejectsStaleBusinessVersionBeforeAnyWrite() {
    when(mapper.reviewById("t", "r")).thenReturn(review("processing"));
    when(mapper.lock("t", "p")).thenReturn(record(4));
    when(mapper.lockReview("t", "r")).thenReturn(review("processing"));
    assertThatThrownBy(() -> projector.complete(instance(), "approved", "reviewer", "ok"))
        .hasMessageContaining("版本");
    verifyNoInteractions(audit);
    verify(mapper, never()).completeReview(any(), any(), any(), any());
  }

  @Test
  void duplicateCompletedCallbackIsIdempotent() {
    when(mapper.reviewById("t", "r")).thenReturn(review("approved"));
    when(mapper.lock("t", "p")).thenReturn(record(3));
    when(mapper.lockReview("t", "r")).thenReturn(review("approved"));
    projector.complete(instance(), "approved", "reviewer", "ok");
    verifyNoInteractions(audit);
    verify(mapper, never()).completeReview(any(), any(), any(), any());
  }

  @Test
  void callbackNeverPermitsSelfApproval() {
    when(mapper.reviewById("t", "r")).thenReturn(review("processing"));
    when(mapper.lock("t", "p")).thenReturn(record(2));
    when(mapper.lockReview("t", "r")).thenReturn(review("processing"));
    assertThatThrownBy(() -> projector.complete(instance(), "approved", "creator", "ok"))
        .hasMessageContaining("自己");
    verifyNoInteractions(audit);
  }
}
