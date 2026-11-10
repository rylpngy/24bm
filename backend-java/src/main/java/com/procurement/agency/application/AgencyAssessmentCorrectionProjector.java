package com.procurement.agency.application;

import com.procurement.agency.domain.AgencyAssessmentRecords.*;
import com.procurement.common.tenant.PermissionDeniedException;
import com.procurement.workflow.domain.WorkflowBusinessInstance;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AgencyAssessmentCorrectionProjector {
  private final AgencyAssessmentContext c;
  private final AgencyAssessmentStages stages;

  public AgencyAssessmentCorrectionProjector(
      AgencyAssessmentContext c, AgencyAssessmentStages stages) {
    this.c = c;
    this.stages = stages;
  }

  private Correction row(WorkflowBusinessInstance i) {
    var row = c.data.correction(i.tenantId(), i.businessId());
    if (row == null) throw new IllegalStateException("更正申请不存在");
    return row;
  }

  private void valid(WorkflowBusinessInstance i, Correction r) {
    var snap = c.s.json.tree(i.businessSnapshot());
    if (!snap.path("requestId").asText().equals(r.id())
        || !snap.path("sheetHash").asText().equals(r.sheetHash())
        || !snap.path("reviewerId").asText().equals(r.userId())
        || !snap.path("reason").asText().equals(r.reason())
        || !snap.path("evidenceHash").asText().equals(r.evidenceHash())
        || !snap.path("cells").equals(c.s.json.tree(r.cellsJson())))
      throw new IllegalStateException("更正申请与审批冻结内容不一致");
    var session = c.data.session(i.tenantId(), r.sessionId());
    c.s.packages.lock(i.tenantId(), session.packageId());
    var sheet = c.data.sheet(i.tenantId(), r.sheetId());
    var latest =
        c.data.sheets(i.tenantId(), r.sessionId(), r.userId()).stream()
            .filter(s -> s.stageKey().equals(sheet.stageKey()))
            .findFirst()
            .orElseThrow();
    if (!r.status().equals("processing")
        || !i.id().equals(r.workflowId())
        || !sheet.status().equals("submitted")
        || sheet.version() != r.sheetVersion()
        || !sheet.contentHash().equals(r.sheetHash())
        || !latest.id().equals(sheet.id())) throw new IllegalStateException("更正待审意见版本已变化");
  }

  @Transactional
  public void validate(WorkflowBusinessInstance i) {
    var r = row(i);
    valid(i, r);
    if (c.s.guard.actor().equals(r.userId())) throw new PermissionDeniedException("不得自行审批更正");
    c.s.guard.permissions().require("buyer:agency:evaluation:correction:approve");
    var session = c.data.session(i.tenantId(), r.sessionId());
    var a = c.access(session.packageId(), session.id(), true);
    c.organizer(a.config());
    stages.correctionAllowed(session.id(), c.data.sheet(i.tenantId(), r.sheetId()), a.config());
    if (!c.s.source(r.evidenceVersionId(), session.packageId()).hash().equals(r.evidenceHash()))
      throw new IllegalStateException("更正依据字节已变化");
  }

  @Transactional
  public void complete(WorkflowBusinessInstance i, String status, String actor, String note) {
    var r = row(i);
    if (r.status().equals(status) && i.id().equals(r.workflowId())) return;
    valid(i, r);
    if (!status.equals("withdrawn")) validate(i);
    var session = c.data.session(i.tenantId(), r.sessionId());
    if (c.data.complete(i.tenantId(), r.id(), i.id(), status, note == null ? "" : note) != 1)
      throw new IllegalStateException("更正回写失败");
    if (status.equals("approved")) {
      var old = c.data.sheet(i.tenantId(), r.sheetId());
      var next =
          c.newDraft(
              i.tenantId(),
              r.sessionId(),
              r.userId(),
              old.stageKey(),
              old.ordinal() + 1,
              old.entriesJson(),
              old.id(),
              r.id());
      c.trace(session.packageId(), "assessment_correction_authorized", old, next);
    }
    c.s.event(
        session.packageId(),
        "assessment_correction_" + status,
        r.id(),
        null,
        java.util.Map.of("sheetId", r.sheetId(), "workflowId", i.id(), "actor", actor),
        note == null ? status : note);
  }
}
